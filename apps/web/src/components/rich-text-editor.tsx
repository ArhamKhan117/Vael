"use client"

import { useEditor, EditorContent, useEditorState } from "@tiptap/react"
import StarterKit from "@tiptap/starter-kit"
import Underline from "@tiptap/extension-underline"
import Link from "@tiptap/extension-link"
import { useCallback, useState, useEffect } from "react"
import { Bold, BoldIcon, ChevronDown, Code, Film, ImageIcon, Italic, Link2, List, ListOrdered, Redo2, Strikethrough, TextAlignCenter, TextAlignEnd, TextAlignJustify, TextAlignStart, UnderlineIcon, Undo2 } from "lucide-react"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuGroup,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Button } from "./ui/button"
import { Input } from "./ui/input"
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field"
import Image from "@tiptap/extension-image"
import Youtube from '@tiptap/extension-youtube'
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from "@/components/ui/tooltip"
import TextAlign from '@tiptap/extension-text-align'

interface RichTextEditorProps {
    /** Controlled value (HTML string) */
    value?: string
    /** Called when content changes */
    onChange?: (html: string) => void
}

export default function RichTextEditor({ value, onChange }: RichTextEditorProps = {}) {
    const editor = useEditor({
        immediatelyRender: false,
        extensions: [
            StarterKit,
            Underline,
            TextAlign.configure({
                types: ['heading', 'paragraph'],
            }),
            Link.configure({
                openOnClick: false,
                autolink: true,
                defaultProtocol: 'https',
                protocols: ['http', 'https'],
                isAllowedUri: (url, ctx) => {
                    try {
                        // construct URL
                        const parsedUrl = url.includes(':') ? new URL(url) : new URL(`${ctx.defaultProtocol}://${url}`)

                        // use default validation
                        if (!ctx.defaultValidate(parsedUrl.href)) {
                            return false
                        }

                        // disallowed protocols
                        const disallowedProtocols = ['ftp', 'file', 'mailto']
                        const protocol = parsedUrl.protocol.replace(':', '')

                        if (disallowedProtocols.includes(protocol)) {
                            return false
                        }

                        // only allow protocols specified in ctx.protocols
                        const allowedProtocols = ctx.protocols.map(p => (typeof p === 'string' ? p : p.scheme))

                        if (!allowedProtocols.includes(protocol)) {
                            return false
                        }

                        // disallowed domains
                        const disallowedDomains = ['example-phishing.com', 'malicious-site.net']
                        const domain = parsedUrl.hostname

                        if (disallowedDomains.includes(domain)) {
                            return false
                        }

                        // all checks have passed
                        return true
                    } catch {
                        return false
                    }
                },
                shouldAutoLink: url => {
                    try {
                        // construct URL
                        const parsedUrl = url.includes(':') ? new URL(url) : new URL(`https://${url}`)

                        // only auto-link if the domain is not in the disallowed list
                        const disallowedDomains = ['example-no-autolink.com', 'another-no-autolink.com']
                        const domain = parsedUrl.hostname

                        return !disallowedDomains.includes(domain)
                    } catch {
                        return false
                    }
                },
            }),
            Image.configure({
                inline: false, // block image
                allowBase64: false,
            }),
            Youtube.configure({
                controls: false,
                nocookie: true,
            }),
        ],
        content: value ?? `<p>Quest description</p>`,
        editorProps: {
            attributes: {
                class:
                    "focus:outline-none min-h-[200px] text-sm prose prose-invert",
            },
        },
        onUpdate: onChange ? ({ editor }) => onChange(editor.getHTML()) : undefined,
    })

    useEffect(() => {
        if (editor && value !== undefined && value !== editor.getHTML()) {
            editor.commands.setContent(value, { emitUpdate: false })
        }
    }, [editor, value])

    const setLink = useCallback(() => {
        const previousUrl = editor?.getAttributes('link').href
        const url = window.prompt('URL', previousUrl)

        // cancelled
        if (url === null) {
            return
        }

        // empty
        if (url === '') {
            editor?.chain().focus().extendMarkRange('link').unsetLink().run()

            return
        }

        // update link
        try {
            editor?.chain().focus().extendMarkRange('link').setLink({ href: url }).run()
        } catch (e: any) {
            alert(e.message)
        }
    }, [editor])

    const editorState = useEditorState({
        editor,
        selector: ctx => ({
            isLink: ctx.editor?.isActive('link'),
            // Text formatting
            isBold: ctx.editor?.isActive('bold') ?? false,
            canBold: ctx.editor?.can().chain().toggleBold().run() ?? false,
            isItalic: ctx.editor?.isActive('italic') ?? false,
            canItalic: ctx.editor?.can().chain().toggleItalic().run() ?? false,
            isStrike: ctx.editor?.isActive('strike') ?? false,
            canStrike: ctx.editor?.can().chain().toggleStrike().run() ?? false,
            isCode: ctx.editor?.isActive('code') ?? false,
            canCode: ctx.editor?.can().chain().toggleCode().run() ?? false,
            canClearMarks: ctx.editor?.can().chain().unsetAllMarks().run() ?? false,
            isUnderline: ctx.editor?.isActive('underline') ?? false,
            canUnderline: ctx.editor?.can().chain().toggleUnderline().run() ?? false,

            // Block types
            isParagraph: ctx.editor?.isActive('paragraph') ?? false,
            isHeading1: ctx.editor?.isActive('heading', { level: 1 }) ?? false,
            isHeading2: ctx.editor?.isActive('heading', { level: 2 }) ?? false,
            isHeading3: ctx.editor?.isActive('heading', { level: 3 }) ?? false,
            isHeading4: ctx.editor?.isActive('heading', { level: 4 }) ?? false,
            isHeading5: ctx.editor?.isActive('heading', { level: 5 }) ?? false,
            isHeading6: ctx.editor?.isActive('heading', { level: 6 }) ?? false,

            // Lists and blocks
            isBulletList: ctx.editor?.isActive('bulletList') ?? false,
            isOrderedList: ctx.editor?.isActive('orderedList') ?? false,
            isCodeBlock: ctx.editor?.isActive('codeBlock') ?? false,
            isBlockquote: ctx.editor?.isActive('blockquote') ?? false,

            // History
            canUndo: ctx.editor?.can().chain().undo().run() ?? false,
            canRedo: ctx.editor?.can().chain().redo().run() ?? false,

            //Formating
            isTextLeft: ctx.editor?.isActive({ textAlign: 'left' }) ?? false,
            // canTextLeft: ctx.editor?.can().chain().setTextAlign('left').run() ?? false,
            isTextCenter: ctx.editor?.isActive({ textAlign: 'center' }) ?? false,
            // canTextCenter: ctx.editor?.can().chain().setTextAlign('center').run() ?? false,
            isTextRight: ctx.editor?.isActive({ textAlign: 'right' }) ?? false,
            // canTextRight: ctx.editor?.can().chain().setTextAlign('right').run() ?? false,
            isTextJustify: ctx.editor?.isActive({ textAlign: 'justify' }) ?? false,
            // canTextJustify: ctx.editor?.can().chain().setTextAlign('justify').run() ?? false,
        }),
    })

    const baseButton =
        "inline-flex h-7 items-center justify-center rounded px-2 text-[11px] font-semibold text-white/70 hover:bg-white/10";

    const activeButton = "bg-white/15 text-white";

    const [linkUrl, setLinkUrl] = useState("")
    const [linkOpen, setLinkOpen] = useState(false)

    useEffect(() => {
        if (!editor) return

        const updateLink = () => {
            const previousUrl = editor.getAttributes("link").href
            setLinkUrl(previousUrl || "")
        }

        editor.on("selectionUpdate", updateLink)
        editor.on("transaction", updateLink)

        return () => {
            editor.off("selectionUpdate", updateLink)
            editor.off("transaction", updateLink)
        }
    }, [editor])

    const handleSetLink = () => {
        if (!editor) return

        if (linkUrl === "") {
            editor.chain().focus().unsetLink().run()
        } else {
            editor
                .chain()
                .focus()
                .extendMarkRange("link")
                .setLink({ href: linkUrl })
                .run()
        }

        setLinkOpen(false) // 👈 close dropdown
    }

    const [imageOpen, setImageOpen] = useState(false)
    const [imageUrl, setImageUrl] = useState("")

    const handleAddImage = () => {
        if (!editor || !imageUrl) return

        editor
            .chain()
            .focus()
            .setImage({ src: imageUrl })
            .run()

        setImageUrl("")
        setImageOpen(false) // close dropdown
    }

    const [videoOpen, setVideoOpen] = useState(false)
    const [videoUrl, setVideoUrl] = useState("")

    const handleAddVideo = () => {
        if (!editor || !videoUrl) return

        editor.commands.setYoutubeVideo({
            src: videoUrl,
            width: 640,
            height: 480,
        })

        setVideoUrl("")
        setVideoOpen(false) // close dropdown
    }

    if (!editor) return null
    return (
        <div className="border border-[#1A1A1A] shadow-md rounded">
            {/* Toolbar */}
            <div className="flex items-center justify-between border-b border-[#1A1A1A] bg-black px-3 py-2 text-xs text-white/70 rounded-tl rounded-tr shadow-xl">
                <div className="flex flex-wrap items-center gap-1 text-xs">
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button
                                variant="default"
                                size="icon-sm"
                                className="rounded bg-black"
                                onClick={() => editor.chain().focus().undo().run()} disabled={!editorState?.canUndo}
                            >
                                <Undo2 className="h-4 w-4" />
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent className="bg-white rounded text-black border border-[#1A1A1A]">
                            <p>Undo</p>
                        </TooltipContent>
                    </Tooltip>

                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button
                                variant="default"
                                size="icon-sm"
                                className="rounded bg-black"
                                onClick={() => editor.chain().focus().redo().run()} disabled={!editorState?.canRedo}
                            >
                                <Redo2 className="h-4 w-4" />
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent className="bg-white rounded text-black border border-[#1A1A1A]">
                            <p>Redo</p>
                        </TooltipContent>
                    </Tooltip>

                    <span className="mx-1 h-4 w-px bg-white" />

                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button size="sm" variant="default" className="rounded bg-black">
                                Aa
                                <ChevronDown className="h-4 w-4" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent className="bg-black text-white" align="start">
                            <DropdownMenuItem onClick={() => editor.chain().focus().setParagraph().run()}>Text</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => editor.chain().focus().setHeading({ level: 1 }).run()}>Heading 1</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => editor.chain().focus().setHeading({ level: 2 }).run()}>Heading 2</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => editor.chain().focus().setHeading({ level: 3 }).run()}>Heading 3</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => editor.chain().focus().setHeading({ level: 4 }).run()}>Heading 4</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => editor.chain().focus().setHeading({ level: 5 }).run()}>Heading 5</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => editor.chain().focus().setHeading({ level: 6 }).run()}>Heading 6</DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>

                    <span className="mx-1 h-4 w-px bg-white" />

                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button
                                variant="default"
                                size="icon-sm"
                                className={`rounded ${editor.isActive("bold") ? 'bg-white/15' : 'bg-black'}`}
                                onClick={() => editor.chain().focus().toggleBold().run()}
                                disabled={!editorState?.canBold}
                            >
                                <BoldIcon className="h-4 w-4" />
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent className="bg-white rounded text-black border border-[#1A1A1A]">
                            <p>Bold</p>
                        </TooltipContent>
                    </Tooltip>

                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button
                                variant="default"
                                size="icon-sm"
                                className={`rounded ${editor.isActive("italic") ? 'bg-white/15' : 'bg-black'}`}
                                onClick={() => editor.chain().focus().toggleItalic().run()}
                                disabled={!editorState?.canItalic}
                            >
                                <Italic className="h-4 w-4" />
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent className="bg-white rounded text-black border border-[#1A1A1A]">
                            <p>Italic</p>
                        </TooltipContent>
                    </Tooltip>

                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button
                                variant="default"
                                size="icon-sm"
                                className={`rounded ${editor.isActive("underline") ? 'bg-white/15' : 'bg-black'}`}
                                onClick={() => editor.chain().focus().toggleUnderline().run()}
                                disabled={!editorState?.canUnderline}
                            >
                                <UnderlineIcon className="h-4 w-4" />
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent className="bg-white rounded text-black border border-[#1A1A1A]">
                            <p>Underline</p>
                        </TooltipContent>
                    </Tooltip>

                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button
                                variant="default"
                                size="icon-sm"
                                className={`rounded ${editor.isActive("strike") ? 'bg-white/15' : 'bg-black'}`}
                                onClick={() => editor.chain().focus().toggleStrike().run()}
                                disabled={!editorState?.canStrike}
                            >
                                <Strikethrough className="h-4 w-4" />
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent className="bg-white rounded text-black border border-[#1A1A1A]">
                            <p>Strikethrough</p>
                        </TooltipContent>
                    </Tooltip>

                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button
                                variant="default"
                                size="icon-sm"
                                className={`rounded ${editor.isActive("code") ? 'bg-white/15' : 'bg-black'}`}
                                onClick={() => editor.chain().focus().toggleCode().run()}
                                disabled={!editorState?.canCode}
                            >
                                <Code className="h-4 w-4" />
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent className="bg-white rounded text-black border border-[#1A1A1A]">
                            <p>Code</p>
                        </TooltipContent>
                    </Tooltip>

                    <span className="mx-1 h-4 w-px bg-white" />

                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button
                                variant="default"
                                size="icon-sm"
                                className={`rounded ${editor.isActive({ textAlign: 'left' }) ? 'bg-white/15' : 'bg-black'}`}
                                onClick={() => editor.chain().focus().setTextAlign('left').run()}
                            // disabled={!editorState?.canTextLeft}
                            >
                                <TextAlignStart className="h-4 w-4" />
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent className="bg-white rounded text-black border border-[#1A1A1A]">
                            <p>Text Align Start</p>
                        </TooltipContent>
                    </Tooltip>

                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button
                                variant="default"
                                size="icon-sm"
                                className={`rounded ${editor.isActive({ textAlign: 'center' }) ? 'bg-white/15' : 'bg-black'}`}
                                onClick={() => editor.chain().focus().setTextAlign('center').run()}
                            >
                                <TextAlignCenter className="h-4 w-4" />
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent className="bg-white rounded text-black border border-[#1A1A1A]">
                            <p>Text Align Center</p>
                        </TooltipContent>
                    </Tooltip>

                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button
                                variant="default"
                                size="icon-sm"
                                className={`rounded ${editor.isActive({ textAlign: 'right' }) ? 'bg-white/15' : 'bg-black'}`}
                                onClick={() => editor.chain().focus().setTextAlign('right').run()}
                            >
                                <TextAlignEnd className="h-4 w-4" />
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent className="bg-white rounded text-black border border-[#1A1A1A]">
                            <p>Text Align End</p>
                        </TooltipContent>
                    </Tooltip>

                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button
                                variant="default"
                                size="icon-sm"
                                className={`rounded ${editor.isActive({ textAlign: 'justify' }) ? 'bg-white/15' : 'bg-black'}`}
                                onClick={() => editor.chain().focus().setTextAlign('justify').run()}
                            >
                                <TextAlignJustify className="h-4 w-4" />
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent className="bg-white rounded text-black border border-[#1A1A1A]">
                            <p>Text Align Justify</p>
                        </TooltipContent>
                    </Tooltip>

                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button
                                variant="default"
                                size="icon-sm"
                                className={`rounded ${editor.isActive('orderedList') ? 'bg-white/15' : 'bg-black'}`}
                                onClick={() => editor.chain().focus().toggleOrderedList().run()}
                            >
                                <ListOrdered className="h-4 w-4" />
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent className="bg-white rounded text-black border border-[#1A1A1A]">
                            <p>Numbered List</p>
                        </TooltipContent>
                    </Tooltip>

                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button
                                variant="default"
                                size="icon-sm"
                                className={`rounded ${editor.isActive('bulletList') ? 'bg-white/15' : 'bg-black'}`}
                                onClick={() => editor.chain().focus().toggleBulletList().run()}
                            >
                                <List className="h-4 w-4" />
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent className="bg-white rounded text-black border border-[#1A1A1A]">
                            <p>Unordered List</p>
                        </TooltipContent>
                    </Tooltip>

                    <span className="mx-1 h-4 w-px bg-white" />

                    <DropdownMenu open={linkOpen} onOpenChange={setLinkOpen}>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <DropdownMenuTrigger asChild>
                                    <Button size="icon-sm" variant="default" className="rounded bg-black">
                                        <Link2 className="h-4 w-4" />
                                        {/* <ChevronDown className="h-4 w-4" /> */}
                                    </Button>
                                </DropdownMenuTrigger>
                            </TooltipTrigger>
                            <TooltipContent className="bg-white rounded text-black border border-[#1A1A1A]">
                                <p>Link</p>
                            </TooltipContent>
                        </Tooltip>

                        <DropdownMenuContent className="bg-black text-white p-4 space-y-4" align="center">
                            <Field>
                                <FieldLabel htmlFor="input-field-username">Link URL</FieldLabel>
                                <Input
                                    id="input-field-link"
                                    type="text"
                                    placeholder="Enter the link"
                                    value={linkUrl}
                                    onChange={(e) => setLinkUrl(e.target.value)}
                                    className="!w-[300px]"
                                />
                            </Field>
                            <div className="flex justify-end">
                                <Button variant="default" size="sm" onClick={handleSetLink} className="rounded bg-white text-black">Save</Button>
                            </div>
                        </DropdownMenuContent>
                    </DropdownMenu>

                    <DropdownMenu open={imageOpen} onOpenChange={setImageOpen}>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <DropdownMenuTrigger asChild>
                                    <Button size="icon-sm" variant="default" className="rounded bg-black">
                                        <ImageIcon className="h-4 w-4" />
                                        {/* <ChevronDown className="h-4 w-4" /> */}
                                    </Button>
                                </DropdownMenuTrigger>
                            </TooltipTrigger>
                            <TooltipContent className="bg-white rounded text-black border border-[#1A1A1A]">
                                <p>Image</p>
                            </TooltipContent>
                        </Tooltip>

                        <DropdownMenuContent
                            className="bg-black text-white p-4 space-y-4"
                            align="center"
                        >
                            <Field>
                                <FieldLabel htmlFor="input-field-image">
                                    Image URL
                                </FieldLabel>

                                <Input
                                    id="input-field-image"
                                    type="text"
                                    placeholder="Enter the image URL"
                                    value={imageUrl}
                                    onChange={(e) => setImageUrl(e.target.value)}
                                    className="!w-[300px]"
                                />
                            </Field>

                            <div className="flex justify-end">
                                <Button
                                    variant="default"
                                    size="sm"
                                    onClick={handleAddImage}
                                    className="rounded bg-white text-black"
                                >
                                    Insert
                                </Button>
                            </div>
                        </DropdownMenuContent>
                    </DropdownMenu>

                    <DropdownMenu open={videoOpen} onOpenChange={setVideoOpen}>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <DropdownMenuTrigger asChild>
                                    <Button size="icon-sm" variant="default" className="rounded bg-black">
                                        <Film className="h-4 w-4" />
                                        {/* <ChevronDown className="h-4 w-4" /> */}
                                    </Button>
                                </DropdownMenuTrigger>
                            </TooltipTrigger>
                            <TooltipContent className="bg-white rounded text-black border border-[#1A1A1A]">
                                <p>Video</p>
                            </TooltipContent>
                        </Tooltip>

                        <DropdownMenuContent
                            className="bg-black text-white p-4 space-y-4"
                            align="center"
                        >
                            <Field>
                                <FieldLabel htmlFor="input-field-image">
                                    Video URL (Youtube)
                                </FieldLabel>

                                <Input
                                    id="input-field-image"
                                    type="text"
                                    placeholder="Enter the video URL"
                                    value={videoUrl}
                                    onChange={(e) => setVideoUrl(e.target.value)}
                                    className="!w-[300px]"
                                />
                            </Field>

                            <div className="flex justify-end">
                                <Button
                                    variant="default"
                                    size="sm"
                                    onClick={handleAddVideo}
                                    className="rounded bg-white text-black"
                                >
                                    Insert
                                </Button>
                            </div>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            </div>
            {/* Editor */}
            <EditorContent editor={editor} className="bg-black rounded-br rounded-bl p-4" />
        </div>
    )
}