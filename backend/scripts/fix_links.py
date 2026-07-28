import docx
from docx.oxml.ns import qn

def expand_hyperlinks(input_file, output_file):
    doc = docx.Document(input_file)
    
    # Iterate through all paragraphs in the document
    for p in doc.paragraphs:
        # Find all hyperlink elements in the paragraph XML
        hyperlink_elements = p._element.findall('.//' + qn('w:hyperlink'))
        
        for hyper in hyperlink_elements:
            # Get the relationship ID
            rId = hyper.get(qn('r:id'))
            if rId and rId in doc.part.rels:
                # Retrieve the target URL from the document's relationships
                rel = doc.part.rels[rId]
                url = rel.target_ref
                
                # We want to append " (URL)" right after the hyperlink element in the paragraph.
                # However, modifying the XML directly in python-docx can be tricky. 
                # Instead, we will add a new run with the URL text immediately after the hyperlink element.
                
                # Create a new run element with the URL
                new_run = docx.oxml.shared.OxmlElement('w:r')
                new_text = docx.oxml.shared.OxmlElement('w:t')
                new_text.set(qn('xml:space'), 'preserve')
                new_text.text = f" ({url})"
                new_run.append(new_text)
                
                # Insert the new run right after the hyperlink element
                hyper.addnext(new_run)
                
    doc.save(output_file)
    print(f"Successfully processed {input_file} and saved to {output_file}")

if __name__ == "__main__":
    input_path = "../data/FAQ _ Demandes et informations (1).docx"
    output_path = "../data/FAQ_Demandes_et_informations_with_links.docx"
    expand_hyperlinks(input_path, output_path)
