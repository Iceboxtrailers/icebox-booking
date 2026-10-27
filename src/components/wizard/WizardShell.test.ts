import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createElement, type ComponentProps } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { WizardShell } from "@/components/wizard/WizardShell";
import { WIZARD_STEPS } from "@/lib/wizard";

// The content goes in as createElement's third argument (the lint rule forbids a children prop); the cast only tells
// TypeScript the props object is complete.
const render = (step: number) =>
  renderToStaticMarkup(createElement(WizardShell, { step } as ComponentProps<typeof WizardShell>, createElement("p", null, "contenu de l'étape")));

describe("the booking steps' frame", () => {
  it("is the frame of a real booking: no prototype notice at the top", () => {
    for (let step = 0; step < WIZARD_STEPS.length; step++) {
      assert.ok(!/prototype|aucune donnée réelle/i.test(render(step)), `step ${step}`);
    }
  });

  it("shows the title of the booking, the step reached, the progress and the step's content", () => {
    const html = render(2);
    assert.match(html, /Réservation en ligne/);
    assert.ok(html.includes(`<h1 class="font-heading mb-4 text-xl">${WIZARD_STEPS[2]}</h1>`));
    assert.match(html, /Étape 3 sur \d+ : [^<]+, en cours/);
    assert.match(html, /contenu de l&#x27;étape|contenu de l'étape/);
    assert.equal((html.match(/<main/g) ?? []).length, 1);
  });
});
