import { ParsedData } from "./metaparser";
import { makeServer } from "./server.helper";
import { TinyParser } from "./tinyparser";

const work = async () => {
  const server = await makeServer(5000);

  const url = "http://localhost:5000/";

  const parser = new TinyParser(url, 10000);

  parser.on("startedParsing", () => {
    console.log("Started Parsing");
  });

  parser.on("error", (err) => {
    console.error(err);
  });

  parser.on("data", (data: ParsedData) => {
    console.log(data);
  });

  parser.on("end", () => {
    console.log("Finished Parsing");
    // server.close();
  });
};

work().catch(console.error);
