export type Tags = "title" | "description" | "image";
export const tags: `og:${Tags}`[] = ["og:title", "og:description", "og:image"];

export type ParsedData = Record<Tags, string>;

export class MetaTagsParser {
  /**
   * @method _parseBody
   * @description Parses the body of the HTML and returns the parsed data. Responsible for parsing the meta tags
   * @param body - The body of the HTML
   * @returns {ParsedData} - The parsed data
   */
  _parseBody(body: string): ParsedData {
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
}
