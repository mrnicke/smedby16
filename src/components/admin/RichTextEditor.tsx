import { useEffect } from 'react';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';

export default function RichTextEditor({ value, onChange }: { value: any; onChange: (value: any) => void }) {
  const editor = useEditor({
    extensions: [StarterKit],
    content: value,
    immediatelyRender: false,
    onUpdate: ({ editor }) => onChange(editor.getJSON()),
  });
  useEffect(() => {
    if (editor && JSON.stringify(editor.getJSON()) !== JSON.stringify(value)) editor.commands.setContent(value);
  }, [editor, value]);
  if (!editor) return null;
  return <div className="rich-editor">
    <div className="rich-toolbar" aria-label="Textformatering">
      <button type="button" className={editor.isActive('bold') ? 'is-active' : ''} onClick={() => editor.chain().focus().toggleBold().run()}>Fet</button>
      <button type="button" className={editor.isActive('italic') ? 'is-active' : ''} onClick={() => editor.chain().focus().toggleItalic().run()}>Kursiv</button>
      <button type="button" onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}>Rubrik</button>
      <button type="button" onClick={() => editor.chain().focus().toggleBulletList().run()}>Lista</button>
      <button type="button" onClick={() => editor.chain().focus().undo().run()}>Ångra</button>
    </div>
    <EditorContent editor={editor} />
  </div>;
}
