import { PDFParse } from 'pdf-parse';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { state as stateShape } from './state';
import { API_BASE } from './config';
import { withAuthHeaders } from './planner-api';
import { createParsedAccountDraft } from './ui';
import { slug } from './utils';
import type { DebtType, ParsedStatementDocument } from '../types';
import type { ParsedAccountDraft } from './types';

type ShellState = typeof stateShape;

PDFParse.setWorker(pdfWorkerUrl);

const combineParsedDocuments = (documents: ParsedStatementDocument[]): ParsedStatementDocument => ({
  documentName:
    documents.length === 1
      ? documents[0].documentName
      : `${documents.length} uploaded statements`,
  issuerHint:
    documents.every((document) => document.issuerHint === documents[0]?.issuerHint)
      ? documents[0]?.issuerHint ?? null
      : null,
  statementDate: null,
  entries: documents.flatMap((document) => document.entries),
  warnings: documents.flatMap((document) => document.warnings),
});

const findTextValueLocal = (text: string, patterns: RegExp[]) => {
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match?.[1]) {
      return match[1].trim();
    }
  }

  return null;
};

const parseCurrencyToCentsLocal = (value: string) =>
  Math.round(Number(value.replace(/[$,\s]/g, '')) * 100);

const inferDebtTypeLocal = (accountType: string, accountLabel = ''): DebtType => {
  const combined = `${accountType} ${accountLabel}`.toLowerCase();
  if (combined.includes('education') || combined.includes('student') || combined.includes('aidvantage') || combined.includes('dept of ed')) {
    return 'education';
  }
  if (combined.includes('credit card') || combined.includes('credit line') || combined.includes('barclays') || combined.includes('capital one') || combined.includes('cbna') || combined.includes('citi') || combined.includes('synchrony') || combined.includes('carecredit')) {
    return 'credit_card';
  }
  if (combined.includes('mortgage')) {
    return 'mortgage';
  }
  if (combined.includes('auto')) {
    return 'auto';
  }
  if (combined.includes('medical')) {
    return 'medical';
  }
  if (combined.includes('collection')) {
    return 'collection';
  }
  if (combined.includes('loan')) {
    return 'personal_loan';
  }
  return 'other';
};

const parseExperianOverviewLocal = (documentName: string, text: string): ParsedStatementDocument => {
  const pages = text.split(/--\s+\d+\s+of\s+\d+\s+--/).map((page) => page.trim()).filter(Boolean);
  const entries = pages
    .filter((page) => page.includes('Account info') && page.includes('Open/closed'))
    .filter((page) => /Open\/closed\s+Open/i.test(page))
    .map((page) => {
      const accountLabel =
        findTextValueLocal(page, [/Account name\s+(.+)/i]) ??
        page.split('\n').map((line) => line.trim()).filter(Boolean)[0] ??
        'Imported account';
      const accountType = findTextValueLocal(page, [/Account type\s+(.+)/i]) ?? '';
      const balance = findTextValueLocal(page, [/Balance\s+\$([0-9,]+\.\d{2}|[0-9,]+)/i]);
      const monthlyPayment = findTextValueLocal(page, [/Monthly payment\s+\$([0-9,]+\.\d{2}|[0-9,]+)/i]);
      const updatedDate = findTextValueLocal(page, [/Balance updated\s+([A-Za-z]+\s+\d{1,2},\s+\d{4})/i]);

      return {
        entryId: `${slug()}-local`,
        sourceDocumentName: documentName,
        accountLabel,
        debtType: inferDebtTypeLocal(accountType, accountLabel),
        accountNumberHint: findTextValueLocal(page, [/Account number\s+([0-9Xx*]+)/i]),
        snapshotDate: updatedDate ? new Date(updatedDate).toISOString().slice(0, 10) : null,
        balanceCents: balance ? parseCurrencyToCentsLocal(balance) : null,
        principalBalanceCents: null,
        accruedInterestCents: null,
        interestChargedCents: null,
        minimumDueCents: monthlyPayment ? parseCurrencyToCentsLocal(monthlyPayment) : null,
        aprBps: null,
        confidence: 'medium' as const,
        matchedDebtId: null,
        sourceExcerpt: `Type ${accountType || 'unknown'} | Balance ${balance ?? 'n/a'} | Monthly payment ${monthlyPayment ?? 'n/a'}`,
      };
    });

  return {
    documentName,
    issuerHint: 'Experian',
    statementDate: null,
    entries,
    warnings: [
      'This bulk import runs in your browser only. The uploaded file is not sent to the parser API.',
      'Personal-information pages are ignored. Imported accounts are a starting point and still need review.',
    ],
  };
};

export const parseStatementFiles = async ({
  state,
  render,
  files,
}: {
  state: ShellState;
  render: () => void;
  files: FileList | File[];
}) => {
  const fileList = Array.from(files);
  if (fileList.length === 0) {
    return;
  }

  state.parsing = true;
  state.parseError = null;
  render();

  try {
    const documents: ParsedStatementDocument[] = [];
    for (const file of fileList) {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch(`${API_BASE}/parse-statement`, {
        method: 'POST',
        headers: withAuthHeaders(state.sessionToken),
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`Could not parse ${file.name}.`);
      }

      documents.push((await response.json()) as ParsedStatementDocument);
    }

    state.parsedStatement = combineParsedDocuments(documents);
    if (!state.statementTargetDebtId && state.activeTab === 'accounts') {
      state.statementTargetDebtId = state.selectedAccountId;
    }
    state.parsedMappings = Object.fromEntries(
      state.parsedStatement.entries.map((entry) => [entry.entryId, entry.matchedDebtId ?? '']),
    );
    state.parsedSelections = Object.fromEntries(
      state.parsedStatement.entries.map((entry) => [entry.entryId, true]),
    );
    state.parsedCursor = 0;
  } catch (error) {
    state.parseError = error instanceof Error ? error.message : 'Unexpected parse error';
  } finally {
    state.parsing = false;
    render();
  }
};

export const parseCreditReportFilesClient = async ({
  state,
  render,
  files,
}: {
  state: ShellState;
  render: () => void;
  files: FileList | File[];
}) => {
  const fileList = Array.from(files);
  if (fileList.length === 0) {
    return;
  }

  state.parsing = true;
  state.parseError = null;
  state.parsedStatement = null;
  state.parsedCursor = 0;
  render();

  try {
    const documents: ParsedStatementDocument[] = [];
    for (const file of fileList) {
      let text = '';
      if (file.name.toLowerCase().endsWith('.pdf')) {
        const data = new Uint8Array(await file.arrayBuffer());
        const parser = new PDFParse({ data });
        try {
          const result = await parser.getText();
          text = result.text;
        } finally {
          await parser.destroy();
        }
      } else {
        text = await file.text();
      }

      documents.push(parseExperianOverviewLocal(file.name, text));
    }

    state.parsedStatement = combineParsedDocuments(documents);
    if (state.parsedStatement.entries.length === 0) {
      state.parseError =
        'The file was read, but no importable accounts were detected. Try a different PDF export or use text selection / print-to-PDF first.';
    }
    state.parsedMappings = {};
    state.parsedSelections = Object.fromEntries(
      state.parsedStatement.entries.map((entry) => [entry.entryId, true]),
    );
    state.parsedAccountDrafts = Object.fromEntries(
      state.parsedStatement.entries.map((entry) => [entry.entryId, createParsedAccountDraft(entry)]),
    ) as Record<string, ParsedAccountDraft>;
    state.parsedCursor = 0;
  } catch (error) {
    state.parseError = error instanceof Error ? error.message : 'Could not parse the uploaded credit report locally.';
  } finally {
    state.parsing = false;
    render();
  }
};
