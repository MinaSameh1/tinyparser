import * as http from "http";
import * as https from "https";
import { setTimeout } from "node:timers/promises";
import { EventEmitter } from "stream";

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

  get URL() {
    return this.url;
  }

  constructor(url: string, timeout: number = 10000) {
    super();
    this.timeout = timeout;
    this.url = url;
    this._startParsing();
  }

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

  /**
   * @method _validateURL
   * @description Validates the URL, emits error if URL is not valid
   * @returns boolean - true if URL is valid, false if URL is not valid
   */
  private _validateURL() {
    if (!this.url) {
      this.emit("error", new Error("URL is required"));
      return false;
    }
    if (!this.url.startsWith("http") && !this.url.startsWith("https")) {
      this.emit("error", new Error("URL should start with http or https"));
      return false;
    }
    return true;
  }

  /**
   * @method _parseBody
   * @description Parses the body of the HTML and returns the parsed data. Responsible for parsing the meta tags
   * @param body - The body of the HTML
   * @returns {ParsedData} - The parsed data
   */
  private _parseBody(body: string): ParsedData {
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

  /**
   * @method _clearTimeout
   * @description Clears the timeout if it exists
   * @returns void
   */
  private _clearTimeout() {
    if (this.timeoutAbortController) {
      this.timeoutAbortController.abort();
      this.timeoutAbortController = null;
    }
  }

  /**
   * @method _setTimeout
   * @description Sets a timeout for the request, if the request takes longer than the timeout, aborts the request
   * @returns void
   */
  private async _setTimeout() {
    try {
      this.timeoutAbortController = new AbortController();
      return await setTimeout(this.timeout, "", {
        signal: this.timeoutAbortController.signal,
      }).then(() => {
        this.httpAbortController.abort();
        this.httpAbortController = new AbortController();
        this.emit("error", new Error("Request Timed Out"));
      });
    } catch (error: unknown) {
      if ((error as Error).name === "AbortError") {
        return;
      }
    }
  }

  /**
   * @method _startParsing
   * @description Starts the parsing of the URL, responsible for making the http call, getting the HTML and emitting events.
   * @returns void
   */
  private _startParsing() {
    const valid = this._validateURL();
    if (!valid) {
      return;
    }

    this._setTimeout().then(() => {
      return;
    });

    this.emit("startedParsing");
    (this.url.startsWith("https") ? https : http)
      .get(
        this.url,
        {
          signal: this.httpAbortController.signal,
        },
        (res) => {
          const { statusCode } = res;
          const contentType = res.headers["content-type"];

          // Validate the response
          let error;
          if (!statusCode || statusCode > 399 || !contentType) {
            error = new Error(
              "Request Failed.\n" + `Status Code: ${statusCode}`,
            );
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

          // Handle errors
          res.on("error", (e) => {
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

          let rawData = "";
          return res.on("data", (chunk) => {
            // Ignore the chunk if it contains style or script tags
            if (!chunk.includes("<style>") || !chunk.includes("<script>"))
              rawData += chunk;

            // if we have the head tag, we can parse the data we care about it
            if (chunk.includes("</head>")) {
              // Get only the important bits
              rawData = rawData.split("</head>")[0] + "</head>";
              // Destroy the connection
              res.destroy();
              // Parse the data
              const data = this._parseBody(rawData);

              this.emit("data", data);
              this._clearTimeout();
              this.emit("end");
            }
          });
        },
      )
      .on("error", (e) => {
        // If the error is an abort error, ignore it
        if (e.name === "AbortError") {
          return;
        }

        // Emit the http error
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
