import fitz


class ImageOnlyPDFError(ValueError):
    """Raised when a PDF contains no extractable text (scanned or image-only)."""


def extract_text_from_pdf(pdf_bytes: bytes) -> str:
    if not pdf_bytes:
        raise ImageOnlyPDFError("Empty PDF file")

    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    all_page_texts: list[str] = []

    try:
        for page in doc:
            # get_text("blocks") returns tuples: (x0, y0, x1, y1, text, block_no, block_type)
            # block_type == 0 indicates text
            blocks = page.get_text("blocks")
            # Sort blocks primarily by x (column) and y (vertical) to preserve two-column reading flow
            text_blocks = [b for b in blocks if b[6] == 0 and b[4].strip()]

            # Determine if page is two-column by checking horizontal distribution
            page_width = page.rect.width
            mid_x = page_width / 2.0

            left_column = []
            right_column = []
            wide_blocks = []

            for b in text_blocks:
                x0, y0, x1, _y1, text = b[0], b[1], b[2], b[3], b[4]
                if x1 <= mid_x + 30:
                    left_column.append((y0, x0, text))
                elif x0 >= mid_x - 30:
                    right_column.append((y0, x0, text))
                else:
                    wide_blocks.append((y0, x0, text))

            # If there's a strong two-column structure
            if left_column and right_column:
                left_column.sort()
                right_column.sort()
                wide_blocks.sort()

                # Order: top wide blocks, then left column, then right column, then bottom wide blocks
                ordered_texts = (
                    [t[2] for t in wide_blocks if t[0] < min(left_column[0][0], right_column[0][0])]
                    + [t[2] for t in left_column]
                    + [t[2] for t in right_column]
                    + [t[2] for t in wide_blocks if t[0] >= min(left_column[0][0], right_column[0][0])]
                )
                page_text = "\n".join(ordered_texts)
            else:
                # Single column: sort by vertical position y0, then x0
                text_blocks.sort(key=lambda b: (b[1], b[0]))
                page_text = "\n".join(b[4] for b in text_blocks)

            if page_text.strip():
                all_page_texts.append(page_text.strip())

        extracted = "\n\n".join(all_page_texts)

        # Count alphanumeric characters to detect scanned/image-only PDFs
        alnum_count = sum(1 for c in extracted if c.isalnum())
        if alnum_count < 30:
            raise ImageOnlyPDFError(
                "Scanned or image-only PDF detected. Please upload a text-based resume."
            )

        return extracted
    finally:
        doc.close()
