import * as http from "http";
import * as https from "https";
import { EventEmitter } from "stream";
import { setTimeout } from "node:timers/promises";

type Tags = "title" | "description" | "image";
const tags: `og:${Tags}`[] = ["og:title", "og:description", "og:image"];

export type ParsedData = Record<Tags, string>;

/**
 * @class TinyParser
 * @description A class to parse a given URL meta tags. Emits events. When constructed will start parsing
 * @event startedParsing - Emitted when the parsing starts
 * @event error - Emitted when an error occurs
 * @event data - {title: string, description: string, image: string} Emitted when the parsing is done, returns the parsed data
 * @event end - Emitted when the parsing ends
 */
export class TinyParser extends EventEmitter {
  private url: string;
  private timeout: number = 10000;
  private timeoutAbortController: AbortController | null = null;
  private httpAbortController = new AbortController();

  /**
   * @method setUrl
   * @description Set the URL to parse, will start parsing the URL
   * @param url - The URL to parse
   * @returns void
   */
  setUrl(url: string) {
    this.url = url;
    this._startParsing();
  }

  get URL() {
    return this.url;
  }

  constructor(url: string, timeout: number = 10000) {
    super();
    this.url = "";

    if (!url) {
      setTimeout(0, () => this.emit("error", new Error("URL is required")))
      return;
    }
    if (!url.startsWith("http") && !url.startsWith("https")) {
      setTimeout(0, () => new Error("URL should start with http or https"))
      return;
    }

    this.timeout = timeout;
    this.url = url;
    this._startParsing();
  }

  private _parseBody(body: string) {
    const obj: ParsedData = {
      title: "",
      description: "",
      image: "",
    };

    for (const line of body.split("\n")) {
      for (const tag of tags) {
        if (line.includes(tag)) {
          const value = line.split('content="')[1].split('"')[0];
          obj[tag.split(":")[1] as Tags] = value;
        }
      }
    }
    return obj;
  }

  private _clearTimeout() {
    if (this.timeoutAbortController) {
      this.timeoutAbortController.abort();
      this.timeoutAbortController = null;
    }
  }

  private async _setTimeout() {
    try {
      this.timeoutAbortController = new AbortController();
      return await setTimeout(this.timeout, "", { signal: this.timeoutAbortController.signal }).then(
        () => {
          this.httpAbortController.abort();
          this.httpAbortController = new AbortController();
          this.emit("error", new Error("Request Timed Out"));
        },
      );
    } catch (error: unknown) {
      if ((error as Error).name === "AbortError") {
        return;
      }
    }
  }

  private _startParsing() {
    if (!this.url || this.url === "") {
      this.emit("error", new Error("URL is required"));
      return;
    }

    this._setTimeout().then(() => {
      return;
    });

    (this.url.startsWith("https") ? https : http)
      .get(this.url, {
        signal: this.httpAbortController.signal,
      }, (res) => {
        const { statusCode } = res;
        const contentType = res.headers["content-type"];

        let error;
        if (!statusCode || statusCode > 399 || !contentType) {
          error = new Error("Request Failed.\n" + `Status Code: ${statusCode}`);
        } else if (
          !/html/.test(contentType) &&
          !/^text\/plain$/.test(contentType)
        ) {
          error = new Error(
            "Invalid content-type.\n" +
            `Expected html or textplain but received ${contentType}`,
          );
        }
        if (error) {
          this.emit("error", error);
          // Consume response data to free up memory
          res.resume();
          return;
        }

        res.setEncoding("utf8");
        let rawData = "";
        return res.on("data", (chunk) => {
          if (!chunk.includes("<style>") || !chunk.includes("<script>"))
            rawData += chunk;
          if (chunk.includes("</head>")) {
            rawData = rawData.split("</head>")[0] + "</head>";
            res.destroy();
            const data = this._parseBody(rawData);
            this.emit("data", data);
            this._clearTimeout();
            this.emit("end");
          }
        });
      })
      .on("error", (e) => {
        if (e.name === "AbortError") {
          return;
        }
        this.emit(
          "error",
          new Error(
            `Tiny Parser Got error while doing http call: ${e.message}`,
            {
              cause: e,
            },
          ),
        );
      });
  }
}
