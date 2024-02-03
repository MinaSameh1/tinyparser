import { ParsedData, TinyParser } from "./tinyparser";

const url = "https://carsonline.bonhams.com/en/";

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
});
