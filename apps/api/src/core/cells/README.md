# cells

A cell = a fully independent stack (Aurora+Redis+OpenSearch+pods) per country/region. India never depends on Bangladesh. Satisfies DPDP/foreign data-residency. Routing decided at the edge (gateway) by tenant→cell; this resolver is the in-app fallback + cell-aware service discovery. [P3]
