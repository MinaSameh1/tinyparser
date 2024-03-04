import http from "node:http";
import assert from "node:assert";
import { after, before, describe, it } from "node:test";
import { TinyParser } from "../src/tinyparser";
import { correctData } from "./data.helper";
import { makeServer } from "../src/server.helper";

describe("TinyParser", () => {
  describe("Works as expected", () => {
    let server: http.Server;

    before(async () => {
      server = await makeServer(5000);
    })

    after(() => {
      server.close();
    });

    it(
      "Should set the URL and start parsing",
      {
        timeout: 10000,
      },
      () => {
        const url = "http://localhost:5000/";

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

        process.on("unhandledRejection", (reason, promise) => {
          console.error("Unhandled Rejection at:", promise, "reason:", reason);
          assert.fail("Unhandled Rejection");
        });
      },
    );
  });

  describe("Cases that emits errors", () => {
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
      try {
        new TinyParser("ftp://example.com/", 10000)
          .on("error", (err) => {
            assert.strictEqual(
              err.message,
              "URL should start with http or https",
            );
            assert.equal(err instanceof Error, true);
          })
          .on("startedParsing", () => {
            assert.fail("Should not emit startedParsing event");
          });
      } catch (error: unknown) {
        assert.strictEqual(
          (error as Error).message,
          "URL should start with http or https",
        );
      }
    });

    it("Should emit an error if timeouted", () => {
      new TinyParser("http://example.com/", 1).on("error", (err) => {
        assert.strictEqual(err.message, "Request Timed Out");
        assert.equal(err instanceof Error, true);
      });
    });
  });
});
