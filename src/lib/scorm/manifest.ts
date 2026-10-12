import { XMLParser } from "fast-xml-parser";

export type ParsedManifest = {
  title: string;
  version: "1.2" | "2004";
  entryPoint: string;
  masteryScore: number | null;
};

type AnyObj = Record<string, unknown>;
const arr = <T,>(v: T | T[] | undefined): T[] => (v === undefined ? [] : Array.isArray(v) ? v : [v]);

/** Extracts launch URL, title and version from an imsmanifest.xml (1.2 and 2004 layouts). */
export function parseManifest(xml: string): ParsedManifest {
  const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "@_", removeNSPrefix: true, textNodeName: "#text" });
  const doc = parser.parse(xml) as AnyObj;
  const manifest = doc.manifest as AnyObj | undefined;
  if (!manifest) throw new Error("imsmanifest.xml non valido: manca <manifest>");

  const schemaVersion = String(((manifest.metadata as AnyObj | undefined)?.schemaversion as string | undefined) ?? "");
  const version: ParsedManifest["version"] = /2004|CAM/i.test(schemaVersion) ? "2004" : "1.2";

  const orgs = manifest.organizations as AnyObj | undefined;
  const orgList = arr(orgs?.organization as AnyObj | AnyObj[] | undefined);
  const defaultId = orgs?.["@_default"] as string | undefined;
  const org = orgList.find((o) => o["@_identifier"] === defaultId) ?? orgList[0];

  // First leaf item with an identifierref (depth-first).
  const findItem = (items: AnyObj[]): AnyObj | undefined => {
    for (const it of items) {
      if (it["@_identifierref"]) return it;
      const child = findItem(arr(it.item as AnyObj | AnyObj[] | undefined));
      if (child) return child;
    }
    return undefined;
  };
  const item = org ? findItem(arr(org.item as AnyObj | AnyObj[] | undefined)) : undefined;

  const resources = arr((manifest.resources as AnyObj | undefined)?.resource as AnyObj | AnyObj[] | undefined);
  const ref = item?.["@_identifierref"] as string | undefined;
  const resource = resources.find((r) => r["@_identifier"] === ref) ?? resources.find((r) => r["@_href"]);
  const href = resource?.["@_href"] as string | undefined;
  if (!href) throw new Error("imsmanifest.xml: nessuna risorsa di lancio (href) trovata");

  const base = (resource?.["@_base"] as string | undefined) ?? "";
  const titleNode = (item?.title ?? org?.title) as string | AnyObj | undefined;
  const title = typeof titleNode === "string" ? titleNode : ((titleNode as AnyObj | undefined)?.["#text"] as string | undefined) ?? "Pacchetto SCORM";
  const mastery = item?.masteryscore as string | number | undefined;

  return {
    title: title.trim(),
    version,
    entryPoint: (base + href).replace(/^\.?\//, ""),
    masteryScore: mastery !== undefined && mastery !== "" ? Number(mastery) : null,
  };
}
