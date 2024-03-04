import http from "http";
import { testHtml } from "../tests/data.helper";
import logger from "./logger";

/**
 * @function makeServer
 * @description Creates a server that returns test HTML. Used for testing purposes only.
 * @returns Promise<http.Server>
 */
export async function makeServer(port = 3000): Promise<http.Server> {
  const server = http.createServer((req, res) => {
    logger.debug(`Test Server Request received: ${req.url} ${req.method}`);
    // If the request is not a GET to the root, return 404
    if (req.url !== "/" || req.method !== "GET") {
      logger.debug(`Test Server Miss`);
      res.writeHead(404, { "Content-Type": "text/plain" });
      res.end("Not Found");
      return;
    }

    // Return the test HTML
    res.writeHead(200, { "Content-Type": "text/html" });
    res.end(testHtml);
  });

  // Wrap in a promise to ensure the server is started before returning
  await new Promise<void>((resolve) => {
    server.listen(port, () => {
      console.log(`Server started on port ${port}`);
      resolve();
    });
  }).catch((err) => {
    throw err;
  });
  return server;
}
