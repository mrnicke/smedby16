import { useEffect } from 'react';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';

export default function RichTextEditor({ value, onChange }: { value: any; onChange: (value: any) => void }) {
  const editor = useEditor({
    extensions: [StarterKit.configure({ heading: { levels: [2, 3] } }), Link.configure({ openOnClick: false, protocols: ['https', 'mailto', 'tel'] })],
    content: value,
    immediatelyRender: false,
    onUpdate: ({ editor }) => onChange(editor.getJSON()),
  });
  useEffect(() => {
    if (editor && JSON.stringify(editor.getJSON()) !== JSON.stringify(value)) editor.commands.setContent(value);
  }, [editor, value]);
  if (!editor) return null;
  const editLink = () => {
    const previous = editor.getAttributes('link').href as string | undefined;
    const href = window.prompt('Ange en intern länk eller en säker https-adress.', previous ?? '/');
    if (href === null) return;
    if (!href) editor.chain().focus().extendMarkRange('link').unsetLink().run();
    else editor.chain().focus().extendMarkRange('link').setLink({ href }).run();
  };
  return <div className="rich-editor">
    <div className="rich-toolbar" aria-label="Textformatering">
      <button type="button" className={editor.isActive('bold') ? 'is-active' : ''} onClick={() => editor.chain().focus().toggleBold().run()}>Fet</button>
      <button type="button" className={editor.isActive('italic') ? 'is-active' : ''} onClick={() => editor.chain().focus().toggleItalic().run()}>Kursiv</button>
      <button type="button" onClick={editLink}>Länk</button>
      <button type="button" onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}>Rubrik 2</button>
      <button type="button" onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}>Rubrik 3</button>
      <button type="button" onClick={() => editor.chain().focus().toggleBulletList().run()}>Punktlista</button>
      <button type="button" onClick={() => editor.chain().focus().toggleOrderedList().run()}>Numrerad lista</button>
      <button type="button" onClick={() => editor.chain().focus().toggleBlockquote().run()}>Citat</button>
      <button type="button" onClick={() => editor.chain().focus().undo().run()}>Ångra</button>
      <button type="button" onClick={() => editor.chain().focus().redo().run()}>Gör om</button>
    </div>
    <EditorContent editor={editor} />
  </div>;
}
