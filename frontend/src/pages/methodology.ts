export const renderMethodology = () => `
  <section class="content-grid">
    <article class="content-panel">
      <div class="panel-header">
        <div>
          <p class="eyebrow">MVP features</p>
          <h3>What you asked for and how this MVP addresses it</h3>
        </div>
      </div>
      <ul class="feature-list">
        <li><strong>Correct interest handling:</strong> the backend now owns the payoff engine and simulates daily or monthly compounding with high-precision math instead of float-heavy shortcuts.</li>
        <li><strong>Promo APR logic that makes sense:</strong> 0% balances are not auto-prioritized first. They reserve only the monthly amount needed to clear before the deadline.</li>
        <li><strong>Deferred-interest awareness:</strong> deferred-interest balances are treated like hard deadlines and raise warnings if the current budget cannot clear them in time.</li>
        <li><strong>Projection view:</strong> the dashboard now shows balance remaining and interest paid after 1, 2, 3, and 5 years.</li>
        <li><strong>Batch payment entry:</strong> multiple payments can now be recorded in one pass instead of one quick-pay at a time.</li>
        <li><strong>Custom input freedom:</strong> each debt can store current balance, minimums, APR, promo APR, promo end date, due day, compounding method, and notes.</li>
        <li><strong>Manual-first architecture:</strong> the data model is built so unsupported institutions can still be tracked accurately without waiting on Plaid.</li>
        <li><strong>Statement reconciliation:</strong> monthly snapshots can now be imported and compared against simulated balances and interest.</li>
      </ul>
    </article>

    <article class="content-panel">
      <div class="panel-header">
        <div>
          <p class="eyebrow">Next steps</p>
          <h3>Unique additions worth building next</h3>
        </div>
      </div>
      <ul class="feature-list">
        <li><strong>Historical replay:</strong> payment history is stored now, but it still needs to be fully applied inside the simulation timeline.</li>
        <li><strong>Statement-cycle timing:</strong> shift from simple due-day timing toward statement close dates and average daily balance behavior.</li>
        <li><strong>Retroactive deferred interest:</strong> model the catch-up charge when those promos miss deadline.</li>
        <li><strong>CSV templates and file upload:</strong> make import less manual than paste-only file text.</li>
        <li><strong>Plaid as enhancement, not truth:</strong> sync supported institutions later into the same internal debt model.</li>
      </ul>
    </article>
  </section>
`;
