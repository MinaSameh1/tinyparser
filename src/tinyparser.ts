import * as http from "http";
import * as https from "https";
import { setTimeout } from "node:timers/promises";
import { EventEmitter } from "stream";
import { logger } from "./logger";
import { MetaTagsParser } from "./metaparser";

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

  emit(eventName: string | symbol, ...args: any[]): boolean {
    if (eventName === "error") {
      logger.error(args[0]);
      return super.emit(eventName, ...args);
    }
    return super.emit(eventName, ...args);
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

  private handleChunk(
    chunk: string,
    rawData: string,
    cb: (data: string) => void,
  ) {
    rawData += chunk;

    // if we have the head tag, we can parse the data we care about it
    if (chunk.includes("</head>")) {
      cb(rawData);
    }
  }

  private handleEnd(rawData: string) {
    logger.debug(`Raw data ${JSON.stringify(rawData, null, 2)}`);
    // Get only the important bits
    rawData = rawData.split("</head>")[0] + "</head>";
    const metaTagsParser = new MetaTagsParser();
    // Parse the data
    const data = metaTagsParser._parseBody(rawData);

    logger.debug(`Parsed data ${JSON.stringify(data, null, 2)}`);

    this.emit("data", data);
    this._clearTimeout();
    this.emit("end");
  }

  private doGetRequest(
    url: string,
    options: http.RequestOptions,
    cb: (res: http.IncomingMessage) => void,
  ) {
    if (url.startsWith("https")) {
      return https.get(url, options, cb);
    }
    return http.get(url, options, cb);
  }

  private handleResponse(res: http.IncomingMessage) {
    const { statusCode } = res;
    const contentType = res.headers["content-type"];

    // Validate the response
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

    // Handle errors
    res.on("error", (e) => {
      this.emit(
        "error",
        new Error(`Tiny Parser Got error while doing http call: ${e.message}`, {
          cause: e,
        }),
      );
    });

    let rawData = "";
    return res.on("data", (chunk) => {
      this.handleChunk(chunk, rawData, (data) => this.handleEnd(data));
    });
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

    this.doGetRequest(
      this.url,
      {
        signal: this.httpAbortController.signal,
      },
      (res) => this.handleResponse(res),
    ).on("error", (e) => {
      // If the error is an abort error, ignore it
      if (e.name === "AbortError") {
        return;
      }

      // Emit the http error
      this.emit(
        "error",
        new Error(`Tiny Parser Got error while doing http call: ${e.message}`, {
          cause: e,
        }),
      );
    });
  }
}
