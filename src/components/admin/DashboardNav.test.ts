import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { DashboardNav } from "@/components/admin/DashboardNav";

const html = (role: "owner" | "employee", problemCount = 0) => renderToStaticMarkup(createElement(DashboardNav, { role, problemCount }));
const labels = (markup: string) => [...markup.matchAll(/<(?:a|button)[^>]*>(.*?)<\/(?:a|button)>/g)].map((m) => m[1].replace(/<[^>]+>/g, "").trim());

describe("the console menu", () => {
  it("gives the owner every page, with reports, traffic and abandoned bookings under one group", () => {
    const owner = html("owner");
    assert.match(owner, /<nav[^>]*aria-label="Console"/);
    assert.deepEqual(
      labels(owner).filter((label) => label && label !== "Menu"),
      ["Tableau de bord", "Clients", "Analyse", "Comptabilité", "Journal", "Employés", "Sécurité"],
    );
    for (const href of ["/dashboard/rapports", "/dashboard/trafic", "/dashboard/abandons"]) assert.ok(!owner.includes(href), "closed group");
  });

  it("gives an employee the dashboard and the security page only, and no empty group", () => {
    const employee = html("employee");
    assert.deepEqual(
      labels(employee).filter((label) => label && label !== "Menu"),
      ["Tableau de bord", "Sécurité"],
    );
    assert.ok(!employee.includes("Analyse"));
  });

  it("shows the problems of the journal next to its entry, and says them to a screen reader", () => {
    assert.ok(html("owner", 3).includes("3</span>"));
    assert.ok(html("owner", 3).includes(", 3 à vérifier"));
    assert.ok(!html("owner", 0).includes("à vérifier"));
  });

  it("has a Menu button for phones that starts closed", () => {
    const owner = html("owner");
    assert.match(owner, /<button[^>]*aria-expanded="false"[^>]*aria-controls="console-menu"/);
    assert.match(owner, /<nav id="console-menu"[^>]*class="hidden md:mt-0 md:block"/);
  });
});
