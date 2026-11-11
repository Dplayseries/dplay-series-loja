// Execute: node tests/tenant-config.test.js
const assert = require("node:assert/strict");
const { tenants, identifyTenant } = require("../tenant-config.js");
assert.equal(identifyTenant("dplay.example", ["nox.example"]).id, "dplay");
assert.equal(identifyTenant("NOX.EXAMPLE", ["nox.example"]).id, "noxplay");
assert.equal(identifyTenant("nox.example.", ["nox.example"]).id, "noxplay");
assert.equal(identifyTenant("fake-nox.example", ["nox.example"]).id, "dplay");
assert.equal(tenants.noxplay.defaultSeriesPriceCents, 400);
assert.equal(Object.prototype.hasOwnProperty.call(tenants.dplay, "defaultSeriesPriceCents"), false);
console.log("Identificação inicial de marcas: OK");
