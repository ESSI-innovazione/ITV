import { Document, Image, Page, StyleSheet, Text, View } from "@react-pdf/renderer";

export type CertificateData = {
  id: string;
  candidateName: string;
  courseTitle: string;
  durationMin: number | null;
  score: number | null;
  issuedAt: string;
  verifyUrl: string;
  qrDataUrl: string;
};

const styles = StyleSheet.create({
  page: { padding: 0, fontFamily: "Helvetica", backgroundColor: "#ffffff" },
  band: { position: "absolute", top: 0, left: 0, right: 0, height: 18, backgroundColor: "#4d53e0" },
  bandBottom: { position: "absolute", bottom: 0, left: 0, right: 0, height: 18, backgroundColor: "#16365f" },
  body: { margin: 48, marginTop: 60, flex: 1 },
  brand: { fontSize: 11, letterSpacing: 3, color: "#4d53e0", fontFamily: "Helvetica-Bold" },
  title: { marginTop: 36, fontSize: 30, color: "#16365f", fontFamily: "Helvetica-Bold" },
  subtitle: { marginTop: 10, fontSize: 12, color: "#6b859e" },
  name: { marginTop: 28, fontSize: 26, color: "#16365f", fontFamily: "Helvetica-Bold" },
  course: { marginTop: 22, fontSize: 15, color: "#16365f", lineHeight: 1.4 },
  meta: { marginTop: 18, fontSize: 11, color: "#6b859e", lineHeight: 1.6 },
  footer: { position: "absolute", bottom: 48, left: 48, right: 48, flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end" },
  sig: { fontSize: 10, color: "#6b859e" },
  sigLine: { width: 180, borderTopWidth: 1, borderTopColor: "#c7d0d9", marginBottom: 6 },
  qrBox: { alignItems: "center" },
  qr: { width: 86, height: 86 },
  certId: { marginTop: 4, fontSize: 9, color: "#16365f", fontFamily: "Courier-Bold" },
  verify: { fontSize: 7.5, color: "#6b859e", marginTop: 2 },
});

/** Landscape A4 certificate in the Sofia palette, with a QR to the public verify page. */
export function CertificatePdf({ data }: { data: CertificateData }) {
  const date = new Date(data.issuedAt).toLocaleDateString("it-IT", { day: "2-digit", month: "long", year: "numeric" });
  return (
    <Document title={`Certificato ${data.id}`} author="ITV Academy">
      <Page size="A4" orientation="landscape" style={styles.page}>
        <View style={styles.band} />
        <View style={styles.body}>
          <Text style={styles.brand}>ITV ACADEMY</Text>
          <Text style={styles.title}>Attestato di partecipazione</Text>
          <Text style={styles.subtitle}>Si certifica che</Text>
          <Text style={styles.name}>{data.candidateName}</Text>
          <Text style={styles.course}>ha completato con successo il corso{"\n"}“{data.courseTitle}”</Text>
          <Text style={styles.meta}>
            {data.durationMin ? `Durata: ${data.durationMin} minuti\n` : ""}
            {data.score !== null ? `Verifica finale superata con punteggio ${Math.round(data.score)}%\n` : ""}
            Rilasciato il {date}
          </Text>
        </View>
        <View style={styles.footer}>
          <View>
            <View style={styles.sigLine} />
            <Text style={styles.sig}>Il responsabile della formazione</Text>
          </View>
          <View style={styles.qrBox}>
            {/* eslint-disable-next-line jsx-a11y/alt-text */}
            <Image src={data.qrDataUrl} style={styles.qr} />
            <Text style={styles.certId}>{data.id}</Text>
            <Text style={styles.verify}>{data.verifyUrl}</Text>
          </View>
        </View>
        <View style={styles.bandBottom} />
      </Page>
    </Document>
  );
}
