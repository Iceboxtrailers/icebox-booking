import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ModelsSection } from "@/components/home/ModelsSection";

const html = renderToStaticMarkup(createElement(ModelsSection));

const plain = (markup: string) => markup.replace(/<[^>]+>/g, "").replace(/&#x27;/g, "'").replace(/\s+/g, " ").trim();

// The cells of each row of the rate grid, as a client reads them (the first row is the header).
const rows = [...(html.match(/<table[\s\S]*?<\/table>/)?.[0] ?? "").matchAll(/<tr[\s\S]*?<\/tr>/g)].map((row) =>
  [...row[0].matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/g)].map((cell) => plain(cell[1])),
);

const cell = (label: RegExp, size: string) => rows.find((row) => label.test(row[0]))?.[rows[0].indexOf(size)];

describe("the rate grid on the home page", () => {
  it("gives the flat rates of the offer sheet, for each size", () => {
    assert.deepEqual(rows[0].slice(1).sort(), ["5x10", "6x12"]);
    assert.equal(cell(/^Jour \(24/, "5x10"), "150.00 $");
    assert.equal(cell(/^Semaine \(7/, "5x10"), "400.00 $");
    assert.equal(cell(/^Mois \(30/, "5x10"), "900.00 $");
    assert.equal(cell(/^Jour \(24/, "6x12"), "180.00 $");
    assert.equal(cell(/^Semaine \(7/, "6x12"), "600.00 $");
    assert.equal(cell(/^Mois \(30/, "6x12"), "1300.00 $");
  });

  it("gives the week and the day after the first full month, the rates a long stay is priced with", () => {
    assert.equal(cell(/^Semaine après un mois complet/, "5x10"), "225.00 $");
    assert.equal(cell(/^Jour après un mois complet/, "5x10"), "32.14 $");
    assert.equal(cell(/^Semaine après un mois complet/, "6x12"), "325.00 $");
    assert.equal(cell(/^Jour après un mois complet/, "6x12"), "46.43 $");
  });

  it("explains under the grid that it is for one continuous rental, a 28th of the month a day, one month at most", () => {
    const text = plain(html);
    assert.match(text, /\* Pour une location continue d'un mois ou plus : les mois complets de 30 jours sont au tarif mensuel/);
    assert.match(text, /chaque jour qui suit est à 1\/28 du tarif mensuel, sans jamais dépasser le prix d'un mois de plus/);
    assert.match(text, /Deux locations distinctes ne sont pas additionnées\./);
  });
});
