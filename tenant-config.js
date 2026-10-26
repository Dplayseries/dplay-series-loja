/* Configuração central de marcas. Sem credenciais ou alteração da DPlay existente.
 * A identificação por hostname deve ser feita também pela API, nunca só no navegador.
 */
(function (root) {
  "use strict";
  const tenants = Object.freeze({
    dplay: Object.freeze({ id: "dplay", name: "DPlay Séries", currency: "BRL" }),
    noxplay: Object.freeze({ id: "noxplay", name: "NoxPlay", currency: "BRL", defaultSeriesPriceCents: 400 })
  });
  function identifyTenant(hostname, noxHosts = []) {
    const normalized = String(hostname || "").trim().toLowerCase().replace(/\.$/, "");
    const configuredHosts = noxHosts.map(h => String(h).toLowerCase().trim());
    return configuredHosts.includes(normalized) ? tenants.noxplay : tenants.dplay;
  }
  const api = Object.freeze({ tenants, identifyTenant });
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.NoxPlayTenants = api;
})(typeof window === "undefined" ? null : window);
