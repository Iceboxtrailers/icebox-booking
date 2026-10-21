import { afterEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import path from "node:path";
import robots from "@/app/robots";
import sitemap from "@/app/sitemap";
import { FAQ_ITEMS } from "@/lib/faq";
import { businessJsonLd, faqJsonLd, pageMetadata } from "@/lib/seo";
import { indexingAllowed, siteUrl } from "@/lib/site";
import { normalizePath } from "@/lib/traffic";

const root = process.cwd();
const saved = { indexable: process.env.SITE_INDEXABLE, host: process.env.VERCEL_PROJECT_PRODUCTION_URL };

function restoreEnv() {
  for (const [name, value] of [["SITE_INDEXABLE", saved.indexable], ["VERCEL_PROJECT_PRODUCTION_URL", saved.host]] as const) {
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
  }
}

describe("site closed to search engines (the default until launch)", () => {
  afterEach(restoreEnv);

  it("stays closed unless SITE_INDEXABLE is exactly 1", () => {
    delete process.env.SITE_INDEXABLE;
    assert.equal(indexingAllowed(), false);
    for (const value of ["", "0", "true", "yes", "on"]) {
      process.env.SITE_INDEXABLE = value;
      assert.equal(indexingAllowed(), false, `SITE_INDEXABLE=${value}`);
    }
    process.env.SITE_INDEXABLE = "1";
    assert.equal(indexingAllowed(), true);
  });

  it("robots.txt turns every crawler away and the sitemap is empty", () => {
    delete process.env.SITE_INDEXABLE;
    assert.deepEqual(robots(), { rules: { userAgent: "*", disallow: "/" } });
    assert.deepEqual(sitemap(), []);
  });
});

describe("site open to search engines (SITE_INDEXABLE=1)", () => {
  afterEach(restoreEnv);

  it("robots.txt welcomes the public pages and keeps the private areas out", () => {
    process.env.SITE_INDEXABLE = "1";
    const result = robots();
    const rules = result.rules as { userAgent: string; allow: string; disallow: string[] };
    assert.equal(rules.allow, "/");
    for (const area of ["/api/", "/dashboard", "/admin", "/compte", "/reservation/", "/depot/", "/login", "/signup", "/mot-de-passe-oublie", "/reinitialiser-mot-de-passe"]) {
      assert.ok(rules.disallow.includes(area), area);
    }
    assert.equal(result.sitemap, `${siteUrl()}/sitemap.xml`);
  });

  it("the sitemap lists the home page first and no private page", () => {
    process.env.SITE_INDEXABLE = "1";
    const entries = sitemap();
    assert.equal(entries[0].url, `${siteUrl()}/`);
    for (const entry of entries) {
      const pathname = new URL(entry.url).pathname;
      assert.ok(!/^\/(api|dashboard|admin|compte|reservation|depot|login|signup)/.test(pathname), pathname);
    }
  });

  it("every page of the sitemap exists and is counted by the visit tracker", () => {
    process.env.SITE_INDEXABLE = "1";
    for (const entry of sitemap()) {
      const pathname = new URL(entry.url).pathname;
      const file = pathname === "/" ? "page.tsx" : `${pathname.slice(1)}/page.tsx`;
      assert.ok(existsSync(path.join(root, "src/app", file)), `${pathname} has no page`);
      assert.equal(normalizePath(pathname), pathname, `${pathname} is not counted by the tracker`);
    }
  });
});

describe("site address", () => {
  afterEach(restoreEnv);

  it("is the production domain given by the host, else the default address", () => {
    delete process.env.VERCEL_PROJECT_PRODUCTION_URL;
    assert.equal(siteUrl(), "https://icebox-booking-master.vercel.app");
    process.env.VERCEL_PROJECT_PRODUCTION_URL = " iceboxtrailers.ca ";
    assert.equal(siteUrl(), "https://iceboxtrailers.ca");
  });
});

describe("link previews and search listing", () => {
  it("a page gets its own title, description and address in every preview format", () => {
    const meta = pageMetadata({ title: "FAQ", description: "Questions fréquentes", path: "/faq" });
    assert.equal(meta.title, "FAQ");
    assert.equal(meta.alternates?.canonical, "/faq");
    assert.equal(meta.openGraph?.url, "/faq");
    assert.equal(meta.openGraph?.title, "FAQ");
    assert.equal(meta.twitter?.title, "FAQ");
  });

  it("the preview image exists and is the 1200 x 630 social format", () => {
    const meta = pageMetadata({ title: "x", description: "y", path: "/" });
    const image = (meta.openGraph?.images as { url: string; width: number; height: number }[])[0];
    assert.deepEqual([image.width, image.height], [1200, 630]);
    assert.ok(existsSync(path.join(root, "public", image.url)), image.url);
  });

  it("the business listing has the phone, the address and a logo that exists", () => {
    const business = businessJsonLd();
    assert.equal(business["@type"], "LocalBusiness");
    assert.equal(business.telephone, "+1-581-889-2093");
    assert.equal(business.address.addressLocality, "Lévis");
    assert.ok(business.logo.startsWith(siteUrl()));
    assert.ok(existsSync(path.join(root, "public", new URL(business.logo).pathname)), business.logo);
  });

  it("the FAQ listing has one question per FAQ entry, each with an answer", () => {
    const faq = faqJsonLd(FAQ_ITEMS);
    assert.equal(faq.mainEntity.length, FAQ_ITEMS.length);
    for (const question of faq.mainEntity) {
      assert.ok(question.name.length > 0);
      assert.ok(question.acceptedAnswer.text.length > 0);
    }
  });
});
