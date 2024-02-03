import assert from "node:assert";
import { describe, it } from "node:test";
import { TinyParser } from "./tinyparser";

describe("TinyParser", () => {
  it(
    "Should set the URL and start parsing",
    {
      timeout: 10000,
    },
    () => {
      const url = "https://carsonline.bonhams.com/en/";
      const correctData = {
        title: "Online Classic and Collectible Car Auctions: Cars for Sale",
        description:
          "24/7 Online Auctions for Classic Cars, Supercars, Vintage Cars and Modern Classics.",
        image:
          "https://a.storyblok.com/f/207143/1200x630/5d8e3f9295/bonhams-cars-online-hq-exterior.JPG",
      };

      const parser = new TinyParser(url, 10000);
      parser.on("startedParsing", () => {
        assert.strictEqual(parser.URL, url);
      });
      parser.on("error", (err) => {
        assert.fail(`Should not emit an error ${err.message}`);
      });

      parser.on("data", (data) => {
        assert.strictEqual(data.title, correctData.title);
        assert.strictEqual(data.description, correctData.description);
        assert.strictEqual(data.image, correctData.image);
      });

      parser.on("end", () => {
        assert.strictEqual(parser.URL, url);
      });
    },
  );

  it("Should emit an error if the URL is not set", () => {
    try {
      // https://nodejs.org/api/events.html#error-events
      new TinyParser("", 10000)
        .on("error", (err) => {
          assert.strictEqual(err.message, "URL is required");
          assert.equal(err instanceof Error, true);
        })
        .on("startedParsing", () => {
          assert.fail("Should not emit startedParsing event");
        });
    } catch (error: unknown) {
      assert.strictEqual((error as Error).message, "URL is required");
    }
  });

  it("Should emit an error if the URL does not start with http or https", () => {
    // https://nodejs.org/api/events.html#error-events
    new TinyParser("ftp://example.com/", 10000)
      .on("error", (err) => {
        assert.strictEqual(err.message, "URL should start with http or https");
        assert.equal(err instanceof Error, true);
      })
      .on("startedParsing", () => {
        assert.fail("Should not emit startedParsing event");
      });
  });

  it("Should emit an error if timeouted", () => {
    const parser = new TinyParser("http://example.com/", 1);
    parser.on("error", (err) => {
      assert.strictEqual(err.message, "Request Timed Out");
      assert.equal(err instanceof Error, true);
    });
  });
});
