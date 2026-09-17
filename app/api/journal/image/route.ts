import { NextResponse } from 'next/server';
import { saveScreenshot } from '@/db/screenshots';

/**
 * An image for a journal page, stored the same way a trade's chart is.
 *
 * Deliberately not a data: URL inlined into the page body. Base64 in the HTML
 * would bloat the row, break the plain-text index, and make the sanitiser's
 * image rule impossible to keep strict — the allowlist lets through exactly
 * one shape of src, this app's own screenshot store, and that is what makes it
 * safe to render the body back with innerHTML.
 */
export async function POST(request: Request) {
  const form = await request.formData().catch(() => null);
  const image = form?.get('image');
  if (!(image instanceof File) || image.size === 0) {
    return NextResponse.json({ error: 'No image given.' }, { status: 400 });
  }
  try {
    return NextResponse.json({ path: await saveScreenshot(image) });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Could not save that image.' },
      { status: 400 },
    );
  }
}
