/*
 * Small file helpers: a PDF of JPEG pages (one per slide), base64 and downloads.
 */

async function bytesOf(data) {
	if (data instanceof Uint8Array) return data;
	if (data instanceof Blob) return new Uint8Array(await data.arrayBuffer());
	if (data instanceof ArrayBuffer) return new Uint8Array(data);
	return new TextEncoder().encode(String(data));
}

export async function pdf(pages) {
	const enc = new TextEncoder();
	const parts = [];
	const offsets = [];
	let length = 0;
	const push = (x) => {
		const b = typeof x === "string" ? enc.encode(x) : x;
		parts.push(b);
		length += b.length;
	};
	push("%PDF-1.4\n%\xE2\xE3\xCF\xD3\n");
	const n = pages.length;
	// objects: 1 catalog, 2 pages, then per page: page, content, image
	const obj = (id, body) => {
		offsets[id] = length;
		push(`${id} 0 obj\n`);
		for (const piece of body) push(piece);
		push("\nendobj\n");
	};
	const kids = pages.map((_, i) => `${3 + i * 3} 0 R`).join(" ");
	obj(1, ["<< /Type /Catalog /Pages 2 0 R >>"]);
	obj(2, [`<< /Type /Pages /Kids [${kids}] /Count ${n} >>`]);
	for (let i = 0; i < n; i++) {
		const page = pages[i];
		const bytes = await bytesOf(page.jpeg);
		const dpi = page.dpi || 150;
		const wPt = (page.width * 72) / dpi;
		const hPt = (page.height * 72) / dpi;
		const pid = 3 + i * 3;
		obj(pid, [
			`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${wPt.toFixed(2)} ${hPt.toFixed(2)}] /Resources << /XObject << /Im${i} ${pid + 2} 0 R >> >> /Contents ${pid + 1} 0 R >>`,
		]);
		const content = `q ${wPt.toFixed(2)} 0 0 ${hPt.toFixed(2)} 0 0 cm /Im${i} Do Q`;
		obj(pid + 1, [
			`<< /Length ${content.length} >>\nstream\n${content}\nendstream`,
		]);
		obj(pid + 2, [
			`<< /Type /XObject /Subtype /Image /Width ${page.width} /Height ${page.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${bytes.length} >>\nstream\n`,
			bytes,
			"\nendstream",
		]);
	}
	const xref = length;
	const total = 3 + n * 3;
	push(`xref\n0 ${total}\n0000000000 65535 f \n`);
	for (let id = 1; id < total; id++)
		push(`${String(offsets[id]).padStart(10, "0")} 00000 n \n`);
	push(`trailer\n<< /Size ${total} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`);
	return new Blob(parts, { type: "application/pdf" });
}

export function blobToBase64(blob) {
	return new Promise((resolve, reject) => {
		const reader = new FileReader();
		reader.onload = () => resolve(String(reader.result).split(",")[1] || "");
		reader.onerror = reject;
		reader.readAsDataURL(blob);
	});
}

export function download(blob, name) {
	const url = URL.createObjectURL(blob);
	const a = document.createElement("a");
	a.href = url;
	a.download = name;
	document.body.appendChild(a);
	a.click();
	a.remove();
	setTimeout(() => URL.revokeObjectURL(url), 30000);
}
