
// ── Embedded SDL data ─────────────────────────────────────────────────────────
const SDL = {platforms:[{id:"p",label:"P",services:[{id:"order-service",label:"Order",domain:"orders",exposes:[],consumes:[],tags:[]}]}],serviceFlowBundles:[],services:[]}; DELIVERED → AWAITING_PAYMENT is not).","Transitioning to CANCELLED emits an order.cancelled event so downstream systems (inventory, payments, notifications) can react.","Status changes are audit-logged with the admin's user ID and a reason."],"preconditions":["User is authenticated with a valid JWT","User has the admin role","The orderId path parameter is a valid UUID","The request body contains a valid target status and a non-empty reason"],"outcomes":["Order status is updated to the requested target status","Status change is recorded in the audit log","If transitioned to CANCELLED, an order.cancelled event is emitted"],"failure_modes":[{"condition":"Order not found","response":"404 Not Found."},{"condition":"Requested status transition is invalid from the current status","response":"409 Conflict — response body includes the current status and valid transitions."}],"domain_events_emitted":["order.cancelled"]},"tags":["admin-only","writes","emits-events"]},{"id":"handle-payment-failed","label":"Handle Payment Failed","description":"Processes a payment.failed event from Kafka. Transitions the order to PAYMENT_FAILED and emits order.cancelled.","business":{"summary":"When Stripe reports a payment failure, this operation transitions the corresponding order from AWAITING_PAYMENT to PAYMENT_FAILED and emits an order.cancelled event so downstream systems (inventory, notifications) can react accordingly.","rules":["Only orders in AWAITING_PAYMENT status may be transitioned by this operation.","Duplicate payment.failed events for the same order must be idempotent.","The customer's rate limit counter is decremented — a failed payment should not count against their daily order quota."],"preconditions":["A payment.failed Kafka event has been received with a valid orderId, paymentIntentId, and failure reason"],"outcomes":["Order is transitioned to PAYMENT_FAILED","order.cancelled event is emitted to Kafka","Customer's 24-hour order rate limit counter is decremented by 1"],"failure_modes":[{"condition":"Order not found or already in a terminal state","response":"Event is acknowledged as a duplicate and discarded."}],"domain_events_emitted":["order.cancelled"]},"routing":{"handler":"OrderEventHandler.handlePaymentFailed","file_ref":"src/handlers/order-event.handler.ts","steps":[{"id":"1.0","action":"fetch order by orderId and validate it is in AWAITING_PAYMENT status","calls":"this.ordersRepository.findById","dependency_ref":"orders-db","returns":"OrderRecord | null","notes":"If not found or not AWAITING_PAYMENT, acknowledge event as duplicate — idempotency guard"},{"id":"2.0","action":"update order status to PAYMENT_FAILED in database","calls":"this.ordersRepository.updateStatus","dependency_ref":"orders-db","returns":"UpdatedOrderRecord","error":{"throws":"DatabaseError","handling":"Do not acknowledge — Kafka will redeliver"}},{"id":"3.0","action":"decrement user rate limit counter in Redis","calls":"this.rateLimitCache.decrement","dependency_ref":"session-cache","returns":"void","notes":"Best-effort — if Redis is unavailable, do not fail the event processing. The counter will expire naturally."},{"id":"4.0","action":"publish order.cancelled event to Kafka via outbox","calls":"this.kafkaProducer.publish","dependency_ref":"event-bus","returns":"void"}],"transaction":{"kind":"outbox","scope":"Order status update + order.cancelled outbox entry written atomically"},"idempotency":{"strategy":"check-then-insert","key":"orderId — status check in step 1.0 ensures duplicate events are no-ops"}},"input_shape_ref":"payment-failed-event","tags":["async","idempotent","writes","emits-events"]}],"dataShapes":[{"id":"create-order-request","label":"Create Order Request","kind":"request","description":"The payload a customer submits when placing an order.","schema_ref":{"type":"zod","ref":"src/schemas/order.schema.ts#CreateOrderRequestSchema"},"fields":[{"name":"lineItems","type":"OrderLineItem[]","required":true,"description":"The items being ordered. Must contain at least one item.","constraints":["Minimum 1 item","Maximum 50 items per order","Each item must have a positive quantity"]},{"name":"shippingAddress","type":"ShippingAddress","required":true,"description":"Where the order should be delivered.","pii":true},{"name":"idempotencyKey","type":"uuid","required":false,"description":"Optional client-generated key to prevent duplicate order submissions on network retry."}],"tags":["validated","request-body"]},{"id":"create-order-response","label":"Create Order Response","kind":"response","description":"Returned to the customer after a successful order creation. Contains everything needed to complete payment on the client side.","fields":[{"name":"orderId","type":"uuid","description":"The newly created order's stable identifier."},{"name":"status","type":"string","description":"Always 'AWAITING_PAYMENT' at creation. The order awaits payment confirmation.","constraints":["Always 'AWAITING_PAYMENT' in this response"]},{"name":"clientSecret","type":"string","description":"Stripe PaymentIntent client_secret — passed to the browser's Stripe.js to complete the payment flow.","sensitive":true},{"name":"reviewFlag","type":"boolean","required":false,"description":"True if the order was flagged for manual review due to value exceeding $10,000. Customer is informed their order is under review."}]},{"id":"order-record","label":"Order Record","kind":"domain-entity","description":"The persisted order as it exists in the database. This is the source of truth for order state.","schema_ref":{"type":"typescript","ref":"src/entities/order.entity.ts#OrderEntity"},"fields":[{"name":"orderId","type":"uuid","description":"Primary key.","sensitive":false},{"name":"userId","type":"uuid","description":"The customer who placed the order.","pii":true},{"name":"status","type":"string","description":"Current state in the order state machine.","constraints":["Enum: AWAITING_PAYMENT | CONFIRMED | PENDING_REVIEW | PAYMENT_FAILED | SHIPPED | DELIVERED | CANCELLED"]},{"name":"lineItems","type":"OrderLineItem[]","description":"Snapshot of line items at order creation time. Immutable after creation."},{"name":"total","type":"number","description":"Total order value in USD cents.","sensitive":true},{"name":"paymentIntentId","type":"string","description":"Stripe PaymentIntent ID associated with this order.","sensitive":true},{"name":"reviewFlag","type":"boolean","description":"True if order exceeds $10,000 and requires manual review. Immutable after creation."},{"name":"shippingAddress","type":"ShippingAddress","description":"Delivery address snapshot.","pii":true},{"name":"createdAt","type":"timestamp","description":"When the order was created."},{"name":"updatedAt","type":"timestamp","description":"When the order was last updated."}],"tags":["persisted","source-of-truth"]},{"id":"payment-completed-event","label":"Payment Completed Event","kind":"event","description":"Kafka event published by the Payment Service when Stripe confirms a payment. Consumed by Order Service to transition an order to CONFIRMED.","schema_ref":{"type":"avro","ref":"./contracts/payment-completed.avsc"},"fields":[{"name":"eventId","type":"uuid","description":"Unique event identifier for idempotency deduplication."},{"name":"orderId","type":"uuid","description":"The order this payment applies to."},{"name":"paymentIntentId","type":"string","description":"Stripe PaymentIntent ID — must match the one stored on the order.","sensitive":true},{"name":"amount","type":"number","description":"Confirmed payment amount in USD cents.","sensitive":true},{"name":"confirmedAt","type":"timestamp","description":"When Stripe confirmed the payment."}],"tags":["event-payload","async"]},{"id":"payment-failed-event","label":"Payment Failed Event","kind":"event","description":"Kafka event published by the Payment Service when Stripe reports a payment failure. Consumed by Order Service to transition an order to PAYMENT_FAILED.","fields":[{"name":"eventId","type":"uuid","description":"Unique event identifier for idempotency deduplication."},{"name":"orderId","type":"uuid","description":"The order for which payment failed."},{"name":"paymentIntentId","type":"string","description":"Stripe PaymentIntent ID.","sensitive":true},{"name":"failureReason","type":"string","description":"Human-readable reason code from Stripe."},{"name":"failedAt","type":"timestamp","description":"When the failure was reported."}],"tags":["event-payload","async"]},{"id":"order-line-item","label":"Order Line Item","kind":"value-object","description":"A single product in an order. Snapshotted at order creation — unit price and product name are captured as-of the moment of order, not looked up dynamically.","fields":[{"name":"productId","type":"uuid","description":"The product being ordered."},{"name":"quantity","type":"number","description":"Number of units ordered.","constraints":["Must be a positive integer (≥ 1)"]},{"name":"unitPrice","type":"number","description":"Price per unit in USD cents, snapshotted at order time.","sensitive":true},{"name":"productName","type":"string","description":"Product name snapshotted at order time — not live from product catalog."}]}],"dependencies":[{"id":"inventory-service","kind":"service","label":"Inventory Service","description":"Checks real-time stock availability for line items before an order is accepted.","interface":{"protocol":"rest","calls":[{"label":"Check stock availability for all line items","method_ref":"this.inventoryClient.checkStock","style":"sync","purpose":"Verify that every line item in the order is in stock at the requested quantity before committing to the order."}]},"reliability":{"timeout_ms":5000,"retry":true,"circuit_breaker":true,"fallback":"Return 409 Conflict — treat inventory service unavailability as stock unavailability"},"client_ref":{"name":"InventoryServiceClient","file_ref":"src/clients/inventory.client.ts"},"tags":["critical-path","sync"]},{"id":"payment-service","kind":"service","label":"Payment Service","description":"Creates Stripe PaymentIntents to initiate the payment flow. The Order Service creates a PaymentIntent before persisting the order; the customer completes payment on the client side.","interface":{"protocol":"rest","calls":[{"label":"Create a Stripe PaymentIntent for the order total","method_ref":"this.paymentClient.createIntent","style":"sync","purpose":"Obtain a Stripe client_secret that the browser uses to complete payment. Must succeed before the order is persisted."}]},"reliability":{"timeout_ms":10000,"retry":false,"circuit_breaker":true,"fallback":"Return 503 Service Unavailable — payment system temporarily unavailable"},"client_ref":{"name":"PaymentServiceClient","file_ref":"src/clients/payment.client.ts"},"tags":["critical-path","sync","pci-scope"]},{"id":"orders-db","kind":"database","label":"Orders PostgreSQL","description":"Primary data store for order records. Owns the orders table and the outbox table used for transactional event publishing.","interface":{"protocol":"database","calls":[{"label":"Insert new order record","method_ref":"this.ordersRepository.insert","style":"sync","purpose":"Persist the order with AWAITING_PAYMENT status alongside the outbox entry for order.created."},{"label":"Fetch order by orderId","method_ref":"this.ordersRepository.findById","style":"sync","purpose":"Load order for status checks and event processing."},{"label":"Update order status","method_ref":"this.ordersRepository.updateStatus","style":"sync","purpose":"Transition order to CONFIRMED, PAYMENT_FAILED, or other states on event receipt."}]},"reliability":{"timeout_ms":3000,"retry":false,"circuit_breaker":false,"fallback":"Return 500 Internal Server Error"},"client_ref":{"name":"OrdersRepository","file_ref":"src/repositories/orders.repository.ts"},"tags":["critical-path","writes","pci-scope"]},{"id":"event-bus","kind":"message-broker","label":"Event Bus (Kafka)","description":"Platform Kafka cluster. Used to publish order lifecycle events (order.created, order.confirmed, order.cancelled) via the transactional outbox pattern.","interface":{"protocol":"kafka","calls":[{"label":"Publish order lifecycle events","method_ref":"this.kafkaProducer.publish","style":"async","purpose":"Notify downstream services (fulfilment, notifications, inventory reservation) of order state changes."}]},"reliability":{"retry":true,"fallback":"Outbox pattern — events written to outbox table atomically with the order record; a background worker publishes them. Kafka unavailability does not fail the order creation."},"client_ref":{"name":"KafkaProducer","file_ref":"src/clients/kafka.producer.ts"},"tags":["async","outbox-pattern"]},{"id":"session-cache","kind":"cache","label":"Session Cache (Redis)","description":"Redis used for per-user rate limiting via a sliding window counter. Tracks the number of orders placed by each user in the last 24 hours.","interface":{"protocol":"redis","calls":[{"label":"Increment order count for user","method_ref":"this.rateLimitCache.increment","style":"sync","purpose":"Check and increment the per-user order count. Rejects if count exceeds 5 per 24 hours."},{"label":"Decrement order count on payment failure","method_ref":"this.rateLimitCache.decrement","style":"sync","purpose":"Restore the user's quota when a payment fails — a failed payment should not count against their daily limit."}]},"reliability":{"timeout_ms":500,"retry":false,"circuit_breaker":true,"fallback":"Fail-open — allow the order to proceed if Redis is unavailable. Rate limiting is best-effort."},"client_ref":{"name":"RateLimitCache","file_ref":"src/clients/redis.client.ts"},"tags":["non-critical-path","fail-open"]}],"dir":"C:\\Code\\github\\software-description-language\\examples\\layer_logic\\order-service","serviceId":"order-service"}]};

// ── State ─────────────────────────────────────────────────────────────────────
let state = {
  layer: 'platform',      // 'platform' | 'service_flows' | 'layer_logic' | 'overview'
  platformIdx: 0,         // index into SDL.platforms
  flowBundleIdx: 0,       // index into SDL.serviceFlowBundles
  serviceId: null,        // string | null — current layer_logic service
  operationId: null,      // string | null — currently expanded operation
  perspective: 'business' // 'business' | 'routing'
};

// ── Overview state ─────────────────────────────────────────────────────────────
const OV = {
  zoom: 1, panX: 40, panY: 40,
  positions: {},   // serviceId -> {x, y}
  toggles: { domains: true, connections: true, kinds: true, tags: false, flows: true },
  drag: null,      // {id, sx, sy, ox, oy, moved}
  pan: null        // {sx, sy, px, py}
};
const NODE_W = 160, NODE_H = 64;
let _ovReady = false; // global mouse event listeners added only once

function navigate(patch) {
  Object.assign(state, patch);
  render();
}

// ── Exposed for Mermaid click callbacks ───────────────────────────────────────
window.__sdlNavService = function(id) { navigate({ layer: 'layer_logic', serviceId: id }); };

// ── Mermaid ───────────────────────────────────────────────────────────────────
// Guard: mermaid CDN may still be loading or unavailable in offline contexts.
if (typeof mermaid !== 'undefined') {
  mermaid.initialize({ startOnLoad: false, securityLevel: 'loose', theme: 'default',
    flowchart: { useMaxWidth: false, htmlLabels: true } });
}

async function renderMermaid(containerId, graphDef) {
  const el = document.getElementById(containerId);
  if (!el) return;
  if (typeof mermaid === 'undefined') {
    el.textContent = '(Mermaid not loaded — diagrams require an internet connection)';
    return;
  }
  try {
    const id = 'g' + Math.random().toString(36).slice(2);
    const { svg } = await mermaid.render(id, graphDef);
    el.innerHTML = svg;
  } catch(e) {
    el.textContent = 'Diagram error: ' + e.message;
  }
}

// ── Top-bar rendering ─────────────────────────────────────────────────────────
function renderTopBar() {
  // Tabs — only show tabs that have data
  const tabs = document.getElementById('layer-tabs');
  const available = [];
  if (SDL.platforms.length)           available.push({ id: 'platform',      label: 'Platform' });
  if (SDL.serviceFlowBundles.length)  available.push({ id: 'service_flows', label: 'Service Flows' });
  if (SDL.services.length)            available.push({ id: 'layer_logic',   label: 'Service Logic' });
  if (SDL.platforms.length || SDL.services.length) available.push({ id: 'overview', label: 'Overview' });

  tabs.innerHTML = available.map(t =>
    `<div class="tab ${state.layer === t.id ? 'active' : ''}"
          onclick="navigate({layer:'${t.id}', serviceId: null, operationId: null})">${t.label}</div>`
  ).join('');

  // Breadcrumb
  const bc = document.getElementById('breadcrumb');
  const crumbs = [];
  if (state.layer === 'layer_logic' && state.serviceId) {
    const svc = SDL.services.find(s => s.serviceId === state.serviceId);
    const label = svc ? svc.manifest.label : state.serviceId;
    crumbs.push(`<span class="crumb" onclick="navigate({layer:'platform',serviceId:null})">${SDL.platforms[0]?.label ?? 'Platform'}</span>`);
    crumbs.push(`<span>›</span><strong>${esc(String(label))}</strong>`);
  }
  bc.innerHTML = crumbs.join(' ');
}

// ── Platform view ─────────────────────────────────────────────────────────────
function renderPlatform() {
  const p = SDL.platforms[state.platformIdx];
  if (!p) { document.getElementById('main').innerHTML = '<p>No platform data found.</p>'; return; }

  const svcs = p.services || [];

  // Build dependency edges from consumes/exposes
  const exposedBy = new Map();
  for (const s of svcs) for (const ex of (s.exposes || [])) exposedBy.set(ex, s.id);
  const edges = [];
  for (const s of svcs) {
    for (const con of (s.consumes || [])) {
      const provider = exposedBy.get(con);
      if (provider && provider !== s.id) {
        const proto = con.split(':')[0];
        edges.push({ from: s.id, to: provider, label: proto });
      }
    }
  }
  // Deduplicate edges (same from/to pair, keep first label)
  const edgeKey = new Set();
  const dedupEdges = edges.filter(e => {
    const k = e.from + '→' + e.to;
    if (edgeKey.has(k)) return false;
    edgeKey.add(k);
    return true;
  });

  // Mermaid graph
  const kindCls = { frontend: ':::frontend', external: ':::external', worker: ':::worker' };
  let graph = 'graph LR\n';
  graph += '  classDef frontend fill:#dbeafe,stroke:#3b82f6,color:#1e40af\n';
  graph += '  classDef external fill:#fef3c7,stroke:#d97706,color:#92400e\n';
  graph += '  classDef worker fill:#dcfce7,stroke:#16a34a,color:#15803d\n';
  for (const s of svcs) {
    const cls = kindCls[s.kind] || '';
    const lbl = s.kind ? s.label + '\\n[' + s.kind + ']' : s.label;
    graph += `  ${safeId(s.id)}["${lbl}"]${cls}\n`;
    graph += `  click ${safeId(s.id)} __sdlNavService\n`;
  }
  for (const e of dedupEdges) {
    graph += `  ${safeId(e.from)} -->|"${e.label}"| ${safeId(e.to)}\n`;
  }

  // Group services by domain
  const byDomain = new Map();
  for (const s of svcs) {
    const d = s.domain || 'other';
    if (!byDomain.has(d)) byDomain.set(d, []);
    byDomain.get(d).push(s);
  }

  const domainHtml = [...byDomain.entries()].map(([domain, list]) => `
    <div style="margin-bottom:8px">
      <div style="font-size:11px;text-transform:uppercase;letter-spacing:.06em;color:var(--muted);margin-bottom:6px;">${esc(domain)}</div>
      ${list.map(s => `
        <div class="svc-row" onclick="navigate({layer:'layer_logic',serviceId:'${s.id}'})">
          <div class="svc-icon ${s.kind || 'backend'}">${kindIcon(s.kind)}</div>
          <div class="svc-name">${esc(s.label)}</div>
          ${s.kind ? `<span class="badge badge-blue">${s.kind}</span>` : ''}
          ${(s.tags||[]).includes('critical-path') ? '<span class="badge badge-amber">critical-path</span>' : ''}
          <svg width="12" height="12" viewBox="0 0 12 12" style="color:var(--muted);flex-shrink:0"><path d="M4 2l4 4-4 4" stroke="currentColor" stroke-width="1.5" fill="none" stroke-linecap="round"/></svg>
        </div>`).join('')}
    </div>`).join('');

  const infra = p.shared_infrastructure || {};
  const infraBadges = Object.entries(infra).filter(([,v]) => v && typeof v === 'object' && v.kind)
    .map(([k, v]) => `<span class="badge badge-gray">${k.replace(/_/g,' ')}: ${v.kind}</span>`).join(' ');

  document.getElementById('main').innerHTML = `
    <div style="margin-bottom:20px">
      ${p.description ? `<p style="color:var(--muted);max-width:720px">${esc(String(p.description))}</p>` : ''}
      ${infraBadges ? `<div style="margin-top:10px;display:flex;gap:6px;flex-wrap:wrap">${infraBadges}</div>` : ''}
    </div>
    <div class="card" style="margin-bottom:20px">
      <div class="card-header"><span class="card-title">Service Dependency Graph</span>
        <span style="font-size:11px;color:var(--muted)">Click a node or service below to view service logic</span></div>
      <div class="card-body"><div class="mermaid-wrap"><div id="platform-graph"></div></div></div>
    </div>
    <div class="card">
      <div class="card-header"><span class="card-title">Services</span>
        <span class="badge badge-gray">${svcs.length}</span></div>
      ${domainHtml}
    </div>`;

  renderMermaid('platform-graph', graph);
}

// ── Service flows view ────────────────────────────────────────────────────────
function renderServiceFlows() {
  const bundle = SDL.serviceFlowBundles[state.flowBundleIdx];
  if (!bundle) { document.getElementById('main').innerHTML = '<p>No service flow data found.</p>'; return; }

  const flowsHtml = bundle.flows.map(flow => {
    const steps = flow.steps || [];
    const actors = new Set(steps.flatMap(s => [s.from_service, s.to_service]).filter(Boolean));

    // Mermaid sequence diagram
    let seq = 'sequenceDiagram\n';
    const actorAlias = id => id.replace(/-/g, '_');
    const trigger = flow.trigger;
    if (trigger?.actor && !actors.has(trigger.actor)) actors.add(trigger.actor);
    for (const a of actors) {
      const label = SDL.platforms[0]?.services?.find(s => s.id === a)?.label ?? a;
      seq += `  participant ${actorAlias(a)} as ${label}\n`;
    }
    let parallelOpen = false;
    for (const step of steps) {
      const from = actorAlias(step.from_service);
      const to   = actorAlias(step.to_service);
      const arrow = step.style === 'async' ? '-->>' : '->>';
      const lbl = String(step.label || '').replace(/"/g, "'");
      if (step.parallel && !parallelOpen) { seq += '  par\n'; parallelOpen = true; }
      else if (!step.parallel && parallelOpen) { seq += '  end\n'; parallelOpen = false; }
      seq += `  ${from}${arrow}${to}: ${lbl}\n`;
    }
    if (parallelOpen) seq += '  end\n';

    const stepsHtml = steps.map(s => {
      const from = SDL.platforms[0]?.services?.find(sv => sv.id === s.from_service)?.label ?? s.from_service;
      const to   = SDL.platforms[0]?.services?.find(sv => sv.id === s.to_service)?.label ?? s.to_service;
      const styleIcon = s.style === 'async' ? '⇢' : '→';
      const protoBadge = s.protocol ? `<span class="badge badge-gray">${s.protocol}</span>` : '';
      const asyncBadge = s.style === 'async' ? '<span class="badge badge-blue">async</span>' : '';
      return `<div class="step">
        <div class="step-id">${s.id}</div>
        <div style="flex:1">
          <div style="font-weight:500">${esc(String(s.label||''))} ${protoBadge} ${asyncBadge}</div>
          <div class="step-arrow">${esc(String(from))} ${styleIcon} ${esc(String(to))}</div>
          ${s.notes ? `<div class="step-meta" style="margin-top:4px">${esc(String(s.notes))}</div>` : ''}
        </div>
      </div>`;
    }).join('');

    const biz = flow.business || {};
    const diagramId = 'flow-' + flow.id;

    return `<details class="card" style="margin-bottom:16px" open>
      <summary class="card-header" style="border-bottom:none">
        <div style="flex:1">
          <span class="card-title">${esc(String(flow.label||flow.id))}</span>
          ${(flow.tags||[]).includes('critical-path') ? ' <span class="badge badge-amber">critical-path</span>' : ''}
        </div>
      </summary>
      <div class="card-body" style="border-top:1px solid var(--border)">
        ${biz.summary ? `<p style="margin-bottom:16px">${esc(String(biz.summary))}</p>` : ''}
        <div class="mermaid-wrap"><div id="${diagramId}"></div></div>
        <div style="margin-top:16px">
          <div style="font-size:11px;text-transform:uppercase;letter-spacing:.06em;color:var(--muted);margin-bottom:8px">Steps</div>
          ${stepsHtml}
        </div>
        ${biz.failure_modes?.length ? `<div style="margin-top:16px">
          <div style="font-size:11px;text-transform:uppercase;letter-spacing:.06em;color:var(--muted);margin-bottom:8px">Failure Modes</div>
          ${biz.failure_modes.map(f => `<div style="padding:6px 0;border-bottom:1px solid var(--border)">
            <span style="font-weight:500">${esc(String(f.condition))}</span>
            <span style="color:var(--muted)"> — ${esc(String(f.response))}</span>
          </div>`).join('')}
        </div>` : ''}
      </div>
    </details>`;
  }).join('');

  document.getElementById('main').innerHTML = flowsHtml;

  // Render each Mermaid diagram
  bundle.flows.forEach(flow => {
    const steps = flow.steps || [];
    const actors = new Set(steps.flatMap(s => [s.from_service, s.to_service]).filter(Boolean));
    const actorAlias = id => id.replace(/-/g, '_');
    let seq = 'sequenceDiagram\n';
    for (const a of actors) {
      const label = SDL.platforms[0]?.services?.find(s => s.id === a)?.label ?? a;
      seq += `  participant ${actorAlias(a)} as ${label}\n`;
    }
    let parallelOpen = false;
    for (const step of steps) {
      const from = actorAlias(step.from_service);
      const to   = actorAlias(step.to_service);
      const arrow = step.style === 'async' ? '-->>' : '->>';
      const lbl = String(step.label || '').replace(/"/g, "'");
      if (step.parallel && !parallelOpen) { seq += '  par\n'; parallelOpen = true; }
      else if (!step.parallel && parallelOpen) { seq += '  end\n'; parallelOpen = false; }
      seq += `  ${from}${arrow}${to}: ${lbl}\n`;
    }
    if (parallelOpen) seq += '  end\n';
    renderMermaid('flow-' + flow.id, seq);
  });
}

// ── Layer logic view ──────────────────────────────────────────────────────────
function renderLayerLogic() {
  // If no specific service selected, show service list
  if (!state.serviceId) {
    const cards = SDL.services.map(svc => {
      const m = svc.manifest;
      return `<div class="card" style="cursor:pointer" onclick="navigate({serviceId:'${svc.serviceId}'})">
        <div class="card-header">
          <div class="svc-icon ${kindForService(svc)}">⚙</div>
          <span class="card-title">${esc(String(m.label||svc.serviceId))}</span>
        </div>
        <div class="card-body">
          ${m.description ? `<p>${esc(String(m.description))}</p>` : ''}
          <div style="margin-top:8px;display:flex;gap:6px;flex-wrap:wrap">
            ${m.domain ? `<span class="badge badge-blue">${m.domain}</span>` : ''}
            <span class="badge badge-gray">${svc.entryPoints.length} entry points</span>
            <span class="badge badge-gray">${svc.operations.length} operations</span>
            <span class="badge badge-gray">${svc.dependencies.length} dependencies</span>
          </div>
        </div>
      </div>`;
    }).join('');
    document.getElementById('main').innerHTML = `<div class="grid-2">${cards}</div>`;
    return;
  }

  const svc = SDL.services.find(s => s.serviceId === state.serviceId);
  if (!svc) { document.getElementById('main').innerHTML = '<p>Service not found.</p>'; return; }
  const m = svc.manifest;

  // Entry points table
  const epRows = svc.entryPoints.map(ep => {
    const opRef = ep.operation_ref || '—';
    const http  = ep.http ? `<code>${ep.http.method} ${ep.http.path}</code>` : '';
    const event = ep.event ? `<code>${ep.event.topic}</code>` : '';
    return `<tr>
      <td><strong>${esc(String(ep.id||''))}</strong></td>
      <td><span class="badge badge-gray">${esc(String(ep.kind||''))}</span></td>
      <td>${http || event}</td>
      <td><code>${esc(String(opRef))}</code></td>
    </tr>`;
  }).join('');

  // Operations accordion
  const opsHtml = svc.operations.map(op => {
    const isOpen = state.operationId === op.id;
    const biz = op.business || {};
    const routing = op.routing;
    const persp = state.perspective;

    const bizContent = `
      <p style="margin-bottom:12px">${esc(String(biz.summary||''))}</p>
      ${biz.rules?.length ? `<div style="margin-bottom:12px">
        <div style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.05em;color:var(--muted);margin-bottom:6px">Business Rules</div>
        <ul class="rules-list">${biz.rules.map(r => `<li>${esc(String(r))}</li>`).join('')}</ul>
      </div>` : ''}
      ${biz.outcomes?.length ? `<div style="margin-bottom:12px">
        <div style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.05em;color:var(--muted);margin-bottom:6px">Outcomes</div>
        <ul class="rules-list">${biz.outcomes.map(o => `<li>${esc(String(o))}</li>`).join('')}</ul>
      </div>` : ''}
      ${biz.failure_modes?.length ? `<div>
        <div style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.05em;color:var(--muted);margin-bottom:6px">Failure Modes</div>
        ${biz.failure_modes.map(f => `<div style="padding:6px 0;border-top:1px solid var(--border)">
          <span style="font-weight:500">${esc(String(f.condition))}</span>
          <span style="color:var(--muted)"> — ${esc(String(f.response))}</span>
        </div>`).join('')}
      </div>` : ''}`;

    const routingContent = routing ? `
      <p style="margin-bottom:12px">Handler: <code>${esc(String(routing.handler||''))}</code>
        ${routing.file_ref ? ` in <code>${esc(String(routing.file_ref))}</code>` : ''}</p>
      ${routing.middleware_chain?.length ? `<div style="margin-bottom:12px">
        <div style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.05em;color:var(--muted);margin-bottom:6px">Middleware</div>
        ${routing.middleware_chain.map(mw => `<div style="padding:4px 0">
          <code>${esc(String(mw.name))}</code>
          ${mw.purpose ? `<span style="color:var(--muted)"> — ${esc(String(mw.purpose))}</span>` : ''}
        </div>`).join('')}
      </div>` : ''}
      ${routing.steps?.length ? `<div>
        <div style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.05em;color:var(--muted);margin-bottom:6px">Execution Steps</div>
        ${routing.steps.map(s => `<div class="step">
          <div class="step-id">${esc(String(s.id))}</div>
          <div style="flex:1">
            <div>${esc(String(s.action||''))}</div>
            ${s.calls ? `<div class="step-meta"><code>${esc(String(s.calls))}</code></div>` : ''}
            ${s.dependency_ref ? `<div class="step-meta">dep: <code>${esc(String(s.dependency_ref))}</code></div>` : ''}
            ${s.notes ? `<div class="step-meta">${esc(String(s.notes))}</div>` : ''}
          </div>
          ${s.parallel ? '<span class="badge badge-blue">parallel</span>' : ''}
        </div>`).join('')}
      </div>` : ''}` : '<p style="color:var(--muted)">No routing block — business perspective only.</p>';

    const perspTabs = `<div class="persp-tabs">
      <div class="persp-tab ${persp==='business'?'active':''}"
           onclick="event.stopPropagation();navigate({operationId:'${op.id}',perspective:'business'})">Business</div>
      <div class="persp-tab ${persp==='routing'?'active':''} ${!routing?'':'...'}"
           onclick="event.stopPropagation();navigate({operationId:'${op.id}',perspective:'routing'})"
           style="${!routing?'opacity:.5;cursor:not-allowed':''}">Routing</div>
    </div>`;

    return `<details class="card" style="margin-bottom:12px" ${isOpen?'open':''}>
      <summary onclick="navigate({operationId:'${isOpen?null:op.id}'})" style="display:flex;align-items:center;gap:8px;padding:12px 18px;cursor:pointer;list-style:none">
        <svg width="10" height="10" viewBox="0 0 10 10" style="flex-shrink:0;transition:transform .15s;${isOpen?'transform:rotate(90deg)':''}"><path d="M2 1l5 4-5 4" stroke="currentColor" stroke-width="1.5" fill="none" stroke-linecap="round"/></svg>
        <strong style="flex:1">${esc(String(op.label||op.id))}</strong>
        ${op.input_shape_ref ? `<code style="font-size:11px">${esc(String(op.input_shape_ref))}</code>` : ''}
        <div style="display:flex;gap:4px">${(op.tags||[]).slice(0,3).map(t => `<span class="badge badge-gray">${esc(String(t))}</span>`).join('')}</div>
      </summary>
      ${isOpen ? `<div style="padding:0 18px 18px;border-top:1px solid var(--border)">
        <div style="padding-top:16px">${perspTabs}</div>
        ${persp === 'business' ? bizContent : routingContent}
      </div>` : ''}
    </details>`;
  }).join('');

  // Dependencies
  const depsHtml = svc.dependencies.map(dep => `
    <tr>
      <td><strong>${esc(String(dep.id||''))}</strong></td>
      <td><span class="badge badge-gray">${esc(String(dep.kind||''))}</span></td>
      <td>${esc(String(dep.label||''))}</td>
      <td style="color:var(--muted)">${dep.interface?.protocol ? `<code>${esc(String(dep.interface.protocol))}</code>` : ''}</td>
    </tr>`).join('');

  // Data shapes
  const shapesHtml = svc.dataShapes.map(ds => `
    <div class="card" style="margin-bottom:10px">
      <div class="card-header">
        <span class="card-title">${esc(String(ds.label||ds.id))}</span>
        <span class="badge badge-gray">${esc(String(ds.kind||''))}</span>
        <code style="font-size:11px;margin-left:auto">${esc(String(ds.id||''))}</code>
      </div>
      ${ds.fields?.length ? `<div class="card-body" style="padding:0">
        <table><thead><tr><th>Field</th><th>Type</th><th>Required</th><th>Description</th></tr></thead>
        <tbody>${(ds.fields||[]).map(f => `<tr>
          <td><code>${esc(String(f.name))}</code></td>
          <td><code>${esc(String(f.type))}</code></td>
          <td>${f.required !== false ? '✓' : ''}</td>
          <td style="color:var(--muted)">${esc(String(f.description||''))}</td>
        </tr>`).join('')}</tbody></table>
      </div>` : ''}
    </div>`).join('');

  document.getElementById('main').innerHTML = `
    <div style="margin-bottom:20px">
      ${m.description ? `<p style="color:var(--muted);max-width:720px">${esc(String(m.description))}</p>` : ''}
      <div style="margin-top:10px;display:flex;gap:6px;flex-wrap:wrap">
        ${m.domain ? `<span class="badge badge-blue">${m.domain}</span>` : ''}
        ${m.technology?.language ? `<span class="badge badge-gray">${m.technology.language}${m.technology.framework ? ' / ' + m.technology.framework : ''}</span>` : ''}
      </div>
    </div>

    <section style="margin-bottom:28px">
      <h2 style="font-size:13px;font-weight:600;text-transform:uppercase;letter-spacing:.06em;color:var(--muted);margin-bottom:12px">Entry Points</h2>
      <div class="card"><div class="card-body" style="padding:0">
        <table><thead><tr><th>ID</th><th>Kind</th><th>Interface</th><th>Operation</th></tr></thead>
        <tbody>${epRows}</tbody></table>
      </div></div>
    </section>

    <section style="margin-bottom:28px">
      <h2 style="font-size:13px;font-weight:600;text-transform:uppercase;letter-spacing:.06em;color:var(--muted);margin-bottom:12px">Operations</h2>
      ${opsHtml}
    </section>

    <section style="margin-bottom:28px">
      <h2 style="font-size:13px;font-weight:600;text-transform:uppercase;letter-spacing:.06em;color:var(--muted);margin-bottom:12px">Dependencies</h2>
      <div class="card"><div class="card-body" style="padding:0">
        <table><thead><tr><th>ID</th><th>Kind</th><th>Label</th><th>Protocol</th></tr></thead>
        <tbody>${depsHtml}</tbody></table>
      </div></div>
    </section>

    <section>
      <h2 style="font-size:13px;font-weight:600;text-transform:uppercase;letter-spacing:.06em;color:var(--muted);margin-bottom:12px">Data Shapes</h2>
      ${shapesHtml}
    </section>`;
}

// ── Overview view ─────────────────────────────────────────────────────────────
function renderOverview() {
  const allSvcs = SDL.platforms.flatMap(p => p.services || []);
  // Restore from localStorage or compute fresh layout on first visit
  if (Object.keys(OV.positions).length === 0) {
    try {
      const saved = localStorage.getItem('sdl-ov-layout');
      if (saved) {
        const l = JSON.parse(saved);
        if (l.sdlLayoutVersion === 1) {
          OV.zoom = l.zoom || 1; OV.panX = l.panX || 40; OV.panY = l.panY || 40;
          Object.assign(OV.positions, l.positions || {});
          Object.assign(OV.toggles, l.toggles || {});
        }
      }
    } catch(e) {}
    if (Object.keys(OV.positions).length === 0 && allSvcs.length) initOvLayout(allSvcs);
  }
  document.getElementById('main').innerHTML = ovHtml();
  buildOvContent(allSvcs);
  setupOvEvents();
  applyOvTransform();
}

function ovHtml() {
  const togs = [
    ['domains','Domains','D'], ['connections','Connections','C'],
    ['kinds','Kinds','K'], ['tags','Tags','T'], ['flows','Flows','F']
  ];
  const btns = togs.map(([k,l,h]) =>
    `<button id="tb-${k}" class="tog-btn${OV.toggles[k] ? ' on' : ''}" onclick="togOv('${k}')">${l} <kbd>${h}</kbd></button>`
  ).join('');
  return `<div id="ov-toolbar">${btns}
    <span style="flex:1"></span>
    <button class="tog-btn" onclick="resetOvView()">Fit <kbd>R</kbd></button>
    <button class="tog-btn" onclick="saveOvLayout()">Save Layout</button>
    <label class="tog-btn" style="cursor:pointer">Load Layout<input type="file" accept=".json" style="display:none" onchange="loadOvLayout(event)"></label>
  </div>
  <div id="ov-wrap"><svg id="ov-svg" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <marker id="ov-arr" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto"><path d="M0,0 L0,6 L8,3 z" fill="#94a3b8"/></marker>
      <marker id="ov-arr-b" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto"><path d="M0,0 L0,6 L8,3 z" fill="#93c5fd"/></marker>
    </defs>
    <rect id="ov-bg" x="-9999" y="-9999" width="19998" height="19998" fill="transparent"/>
    <g id="ov-world"><g id="ov-domains"></g><g id="ov-edges"></g><g id="ov-flows"></g><g id="ov-nodes"></g></g>
  </svg></div>`;
}

function buildOvContent(allSvcs) {
  buildOvDomains(allSvcs);
  buildOvEdges(allSvcs);
  buildOvFlows();
  buildOvNodes(allSvcs);
  applyOvToggles();
}

function buildOvDomains(allSvcs) {
  const g = document.getElementById('ov-domains');
  if (!g) return;
  const byDomain = groupByDomain(allSvcs);
  let html = '';
  byDomain.forEach((svcs, domain) => {
    const b = getDomainBounds(svcs);
    if (b.w === 0) return;
    html += '<rect data-domain="' + esc(domain) + '" x="' + b.x + '" y="' + b.y + '" width="' + b.w + '" height="' + b.h + '" rx="10" fill="#f0f4ff" stroke="#c7d2fe" stroke-width="1.5"/>';
    html += '<text data-domain-lbl="' + esc(domain) + '" x="' + (b.x+14) + '" y="' + (b.y+18) + '" font-size="11" font-weight="600" fill="#6b7280">' + esc(domain) + '</text>';
  });
  g.innerHTML = html;
}

function buildOvEdges(allSvcs) {
  const g = document.getElementById('ov-edges');
  if (!g) return;
  const exposedBy = new Map();
  allSvcs.forEach(s => (s.exposes||[]).forEach(ex => exposedBy.set(ex, s.id)));
  const seen = new Set();
  let html = '';
  allSvcs.forEach(s => {
    (s.consumes||[]).forEach(con => {
      const prov = exposedBy.get(con);
      if (!prov || prov === s.id) return;
      const key = s.id + '|' + prov;
      if (seen.has(key)) return;
      seen.add(key);
      const fp = OV.positions[s.id], tp = OV.positions[prov];
      if (!fp || !tp) return;
      html += '<path data-from="' + s.id + '" data-to="' + prov + '" d="' + makeEdgePath(fp, tp, false) + '" stroke="#94a3b8" stroke-width="1.5" fill="none" marker-end="url(#ov-arr)"/>';
    });
  });
  g.innerHTML = html;
}

function buildOvFlows() {
  const g = document.getElementById('ov-flows');
  if (!g) return;
  const seen = new Set();
  let html = '';
  SDL.serviceFlowBundles.forEach(bundle => {
    bundle.flows.forEach(flow => {
      (flow.steps||[]).forEach(step => {
        if (!step.from_service || !step.to_service) return;
        const key = step.from_service + '|' + step.to_service;
        if (seen.has(key)) return;
        seen.add(key);
        const fp = OV.positions[step.from_service], tp = OV.positions[step.to_service];
        if (!fp || !tp) return;
        html += '<path data-from="' + step.from_service + '" data-to="' + step.to_service + '" d="' + makeEdgePath(fp, tp, true) + '" stroke="#93c5fd" stroke-width="1.5" stroke-dasharray="5,3" fill="none" marker-end="url(#ov-arr-b)"/>';
      });
    });
  });
  g.innerHTML = html;
}

function buildOvNodes(allSvcs) {
  const g = document.getElementById('ov-nodes');
  if (!g) return;
  const COLORS = {
    frontend: {fill:'#dbeafe',stroke:'#93c5fd'},
    external:  {fill:'#fef3c7',stroke:'#fcd34d'},
    worker:    {fill:'#dcfce7',stroke:'#86efac'},
    backend:   {fill:'#f0f4ff',stroke:'#c7d2fe'}
  };
  let html = '';
  allSvcs.forEach(s => {
    const pos = OV.positions[s.id] || {x:0,y:0};
    const c = COLORS[s.kind] || COLORS.backend;
    const tags = (s.tags||[]).slice(0,3).join(' · ');
    html += '<g class="ov-node" data-id="' + s.id + '" transform="translate(' + pos.x + ',' + pos.y + ')">';
    html += '<rect class="ov-box" width="' + NODE_W + '" height="' + NODE_H + '" rx="8" fill="' + c.fill + '" stroke="' + c.stroke + '" stroke-width="1.5"/>';
    html += '<text x="' + (NODE_W/2) + '" y="24" text-anchor="middle" font-size="13" font-weight="600" fill="#1e293b">' + esc(String(s.label||s.id)) + '</text>';
    html += '<text class="ov-kind" x="' + (NODE_W/2) + '" y="41" text-anchor="middle" font-size="11" fill="#64748b">' + esc(s.kind ? '['+s.kind+']' : (s.domain||'')) + '</text>';
    if (tags) html += '<text class="ov-tags" x="' + (NODE_W/2) + '" y="56" text-anchor="middle" font-size="10" fill="#94a3b8">' + esc(tags) + '</text>';
    html += '</g>';
  });
  g.innerHTML = html;
  // Attach per-node drag listeners
  document.querySelectorAll('.ov-node').forEach(el => {
    el.addEventListener('mousedown', e => {
      e.stopPropagation();
      const id = el.dataset.id;
      const pos = OV.positions[id] || {x:0,y:0};
      OV.drag = { id, sx: e.clientX, sy: e.clientY, ox: pos.x, oy: pos.y, moved: false };
      el.classList.add('dragging');
    });
  });
}

function makeEdgePath(fp, tp, isFlow) {
  const fx = fp.x + NODE_W/2, fy = fp.y + NODE_H/2;
  const tx = tp.x + NODE_W/2, ty = tp.y + NODE_H/2;
  const dx = tx - fx, dy = ty - fy;
  const off = Math.min(80, Math.max(30, (Math.abs(dx) + Math.abs(dy)) / 4)) + (isFlow ? 24 : 0);
  let x1, y1, x2, y2, cpx1, cpy1, cpx2, cpy2;
  if (Math.abs(dx) >= Math.abs(dy)) {
    x1 = dx > 0 ? fp.x + NODE_W : fp.x; y1 = fp.y + NODE_H/2;
    x2 = dx > 0 ? tp.x : tp.x + NODE_W; y2 = tp.y + NODE_H/2;
    cpx1 = dx > 0 ? x1+off : x1-off; cpy1 = y1;
    cpx2 = dx > 0 ? x2-off : x2+off; cpy2 = y2;
  } else {
    x1 = fp.x + NODE_W/2; y1 = dy > 0 ? fp.y + NODE_H : fp.y;
    x2 = tp.x + NODE_W/2; y2 = dy > 0 ? tp.y : tp.y + NODE_H;
    cpx1 = x1; cpy1 = dy > 0 ? y1+off : y1-off;
    cpx2 = x2; cpy2 = dy > 0 ? y2-off : y2+off;
  }
  return 'M'+x1+','+y1+' C'+cpx1+','+cpy1+' '+cpx2+','+cpy2+' '+x2+','+y2;
}

function setupOvEvents() {
  const wrap = document.getElementById('ov-wrap');
  const bg   = document.getElementById('ov-bg');
  if (!wrap || !bg) return;

  // Zoom centered on cursor position
  wrap.addEventListener('wheel', e => {
    e.preventDefault();
    const factor = e.deltaY < 0 ? 1.1 : 0.9;
    const rect = wrap.getBoundingClientRect();
    const mx = e.clientX - rect.left, my = e.clientY - rect.top;
    OV.panX = mx - factor * (mx - OV.panX);
    OV.panY = my - factor * (my - OV.panY);
    OV.zoom = Math.max(0.1, Math.min(5, OV.zoom * factor));
    applyOvTransform();
  }, { passive: false });

  // Pan via background drag
  bg.addEventListener('mousedown', e => {
    e.preventDefault();
    OV.pan = { sx: e.clientX, sy: e.clientY, px: OV.panX, py: OV.panY };
    wrap.classList.add('panning');
  });

  // Global move + up handlers (registered only once per page load)
  if (!_ovReady) {
    _ovReady = true;
    document.addEventListener('mousemove', e => {
      if (OV.drag) {
        if (Math.abs(e.clientX - OV.drag.sx) > 3 || Math.abs(e.clientY - OV.drag.sy) > 3)
          OV.drag.moved = true;
        const nx = OV.drag.ox + (e.clientX - OV.drag.sx) / OV.zoom;
        const ny = OV.drag.oy + (e.clientY - OV.drag.sy) / OV.zoom;
        OV.positions[OV.drag.id] = { x: nx, y: ny };
        const node = document.querySelector('.ov-node[data-id="' + OV.drag.id + '"]');
        if (node) node.setAttribute('transform', 'translate(' + nx + ',' + ny + ')');
        updateEdgesForNode(OV.drag.id);
      } else if (OV.pan) {
        OV.panX = OV.pan.px + (e.clientX - OV.pan.sx);
        OV.panY = OV.pan.py + (e.clientY - OV.pan.sy);
        applyOvTransform();
      }
    });
    document.addEventListener('mouseup', () => {
      if (OV.drag) {
        const node = document.querySelector('.ov-node[data-id="' + OV.drag.id + '"]');
        if (node) node.classList.remove('dragging');
        if (!OV.drag.moved) {
          // Click without drag → navigate to service logic
          navigate({ layer: 'layer_logic', serviceId: OV.drag.id });
        } else {
          rebuildDomainRects();
          persistOvLayout();
        }
        OV.drag = null;
      }
      if (OV.pan) {
        OV.pan = null;
        const w = document.getElementById('ov-wrap');
        if (w) w.classList.remove('panning');
      }
    });
  }
}

function applyOvTransform() {
  const world = document.getElementById('ov-world');
  if (world) world.setAttribute('transform',
    'translate(' + OV.panX + ',' + OV.panY + ') scale(' + OV.zoom + ')');
}

function updateEdgesForNode(id) {
  document.querySelectorAll('#ov-edges path, #ov-flows path').forEach(el => {
    if (el.dataset.from !== id && el.dataset.to !== id) return;
    const fp = OV.positions[el.dataset.from], tp = OV.positions[el.dataset.to];
    if (fp && tp) el.setAttribute('d', makeEdgePath(fp, tp, !!el.closest('#ov-flows')));
  });
}

function rebuildDomainRects() {
  const allSvcs = SDL.platforms.flatMap(p => p.services || []);
  groupByDomain(allSvcs).forEach((svcs, domain) => {
    const b = getDomainBounds(svcs);
    const rect = document.querySelector('[data-domain="' + esc(domain) + '"]');
    const txt  = document.querySelector('[data-domain-lbl="' + esc(domain) + '"]');
    if (rect) { rect.setAttribute('x',b.x); rect.setAttribute('y',b.y);
                rect.setAttribute('width',b.w); rect.setAttribute('height',b.h); }
    if (txt)  { txt.setAttribute('x',b.x+14); txt.setAttribute('y',b.y+18); }
  });
}

function togOv(key) {
  OV.toggles[key] = !OV.toggles[key];
  applyOvToggles();
  const btn = document.getElementById('tb-' + key);
  if (btn) btn.className = 'tog-btn' + (OV.toggles[key] ? ' on' : '');
  persistOvLayout();
}

function applyOvToggles() {
  [['domains','ov-domains'],['connections','ov-edges'],['flows','ov-flows']].forEach(([k,id]) => {
    const el = document.getElementById(id);
    if (el) el.style.display = OV.toggles[k] ? '' : 'none';
  });
  document.querySelectorAll('.ov-kind').forEach(el => { el.style.display = OV.toggles.kinds ? '' : 'none'; });
  document.querySelectorAll('.ov-tags').forEach(el => { el.style.display = OV.toggles.tags  ? '' : 'none'; });
}

function resetOvView() {
  const keys = Object.keys(OV.positions);
  if (!keys.length) { OV.zoom=1; OV.panX=40; OV.panY=40; applyOvTransform(); return; }
  let minX=Infinity, minY=Infinity, maxX=-Infinity, maxY=-Infinity;
  keys.forEach(id => {
    const p = OV.positions[id];
    minX=Math.min(minX,p.x); minY=Math.min(minY,p.y);
    maxX=Math.max(maxX,p.x+NODE_W); maxY=Math.max(maxY,p.y+NODE_H);
  });
  const wrap = document.getElementById('ov-wrap');
  const ww = wrap ? wrap.clientWidth : 800, wh = wrap ? wrap.clientHeight : 600;
  const cw = maxX-minX+80, ch = maxY-minY+80;
  OV.zoom = Math.min(1.5, Math.min(ww/cw, wh/ch));
  OV.panX = (ww - cw*OV.zoom)/2 - minX*OV.zoom + 40;
  OV.panY = (wh - ch*OV.zoom)/2 - minY*OV.zoom + 40;
  applyOvTransform();
}

function persistOvLayout() {
  try {
    localStorage.setItem('sdl-ov-layout', JSON.stringify({
      sdlLayoutVersion: 1, zoom: OV.zoom, panX: OV.panX, panY: OV.panY,
      positions: OV.positions, toggles: OV.toggles
    }));
  } catch(e) {}
}

function saveOvLayout() {
  persistOvLayout();
  const layout = { sdlLayoutVersion: 1, zoom: OV.zoom, panX: OV.panX, panY: OV.panY,
                   positions: OV.positions, toggles: OV.toggles };
  const blob = new Blob([JSON.stringify(layout, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'sdl-layout.json';
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  URL.revokeObjectURL(a.href);
}

function loadOvLayout(e) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = ev => {
    try {
      const l = JSON.parse(ev.target.result);
      if (l.sdlLayoutVersion === 1) {
        OV.zoom = l.zoom || 1; OV.panX = l.panX || 40; OV.panY = l.panY || 40;
        Object.assign(OV.positions, l.positions || {});
        Object.assign(OV.toggles, l.toggles || {});
        renderOverview();
        persistOvLayout();
      }
    } catch(err) { alert('Invalid layout file: ' + err.message); }
  };
  reader.readAsText(file);
}

function initOvLayout(svcs) {
  const byDomain = groupByDomain(svcs);
  let x = 60;
  byDomain.forEach(dsvc => {
    let y = 60;
    dsvc.forEach(s => { OV.positions[s.id] = { x, y }; y += NODE_H + 30; });
    x += NODE_W + 80;
  });
}

function groupByDomain(svcs) {
  const m = new Map();
  svcs.forEach(s => {
    const d = s.domain || 'other';
    if (!m.has(d)) m.set(d, []);
    m.get(d).push(s);
  });
  return m;
}

function getDomainBounds(svcs) {
  let minX=Infinity, minY=Infinity, maxX=-Infinity, maxY=-Infinity;
  svcs.forEach(s => {
    const p = OV.positions[s.id];
    if (!p) return;
    minX=Math.min(minX,p.x); minY=Math.min(minY,p.y);
    maxX=Math.max(maxX,p.x+NODE_W); maxY=Math.max(maxY,p.y+NODE_H);
  });
  if (minX === Infinity) return { x:0, y:0, w:0, h:0 };
  return { x:minX-20, y:minY-28, w:maxX-minX+40, h:maxY-minY+48 };
}

// ── Utilities ─────────────────────────────────────────────────────────────────
function esc(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function safeId(id) { return id.replace(/[^a-zA-Z0-9_]/g, '_'); }
function kindIcon(kind) {
  return { frontend: '🖥', external: '🌐', worker: '⚙' }[kind] || '◈';
}
function kindForService(svc) {
  // Try to derive kind from platform manifest
  const actor = SDL.platforms[0]?.services?.find(s => s.id === svc.serviceId);
  return actor?.kind || 'backend';
}

// ── Main render loop ──────────────────────────────────────────────────────────
function render() {
  renderTopBar();
  switch (state.layer) {
    case 'platform':      renderPlatform();      break;
    case 'service_flows': renderServiceFlows();  break;
    case 'layer_logic':   renderLayerLogic();    break;
    case 'overview':      renderOverview();      break;
    default: renderPlatform();
  }
}

// ── Boot ──────────────────────────────────────────────────────────────────────
(function init() {
  // Choose a sensible default layer
  if (SDL.platforms.length)          state.layer = 'platform';
  else if (SDL.serviceFlowBundles.length) state.layer = 'service_flows';
  else if (SDL.services.length)      state.layer = 'layer_logic';
  render();
})();

// ── Overview keyboard shortcuts ───────────────────────────────────────────────
document.addEventListener('keydown', e => {
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
  if (state.layer !== 'overview') return;
  const map = { d:'domains', c:'connections', k:'kinds', t:'tags', f:'flows' };
  const key = e.key.toLowerCase();
  if (map[key]) { togOv(map[key]); e.preventDefault(); return; }
  if (key === 'r') { resetOvView(); e.preventDefault(); }
});
