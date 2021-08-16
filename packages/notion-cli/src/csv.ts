import path from "path";
import fs from "fs";
import * as CSV from "@fast-csv/parse";

const csvParse = (filePath: string) => {
  const raw = fs.readFileSync(filePath, { encoding: "utf-8" });
  const [headers, ...rows] = raw.split("\n").map((x) => x.split("\t"));
  return headers;
};

export const create = async (argv) => {
  const data = csvParse(path.resolve(argv.input));
  console.log(data);
  return Promise.resolve();
};

export const update = (argv) => {
  return Promise.resolve();
};
