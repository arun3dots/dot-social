'use client';

import React, { useRef, useState } from 'react';
import { PostItem, UserSession } from '@/types';
import { specFor } from '@/lib/platformSpecs';
import PlatformPreview from '@/components/PlatformPreview';
import { Linkedin, Twitter, Instagram, Check, Send, Trash2, Copy, Image as ImageIcon, Calendar, Clock, CheckCircle2 } from 'lucide-react';

interface Props {
  post: PostItem;
  dayIndex: number;
  /** Rendered under the header (the platform tabs when this is a whole day's set). */
  headerExtra?: React.ReactNode;
  /** Rendered in the footer, left of Save/Close (approve / dispatch / remove for this post). */
  actions?: React.ReactNode;
  /** Roomier layout for the grouped, tabbed view. */
  wide?: boolean;
  /** The other posts on this day, so the platform previews can show each platform's own image. */
  siblings?: PostItem[];
  llm?: { provider?: string; apiKey?: string; imageApiKey?: string; imageQuality?: string };
  user?: UserSession;
  availableImages?: string[];
  /** Persists the given fields through the parent (server-truth; the parent re-reads the response). */
  onSave: (dayIndex: number, postId: string, fields: Partial<PostItem>) => void;
  onClose: () => void;
  onDuplicatePost?: (sourcePost: PostItem, targetDate: string, targetTime: string, autoSchedule: boolean) => Promise<void>;
  onApprovePost?: (post: PostItem) => void;
}

type Busy = null | 'content' | 'hashtags' | 'image' | 'upload' | 'tag' | 'save';

const QUALITY_COST: Record<string, string> = {
  low: '~$0.01/image',
  medium: '~$0.04/image',
  high: '~$0.17/image',
};

/**
 * Full post editor.
 *
 * Everything here goes through the server: regenerated copy and images are generated server-side
 * and stored, uploads are stored, and every result line reports what the server actually did.
 * Image regeneration uses the same generator as a batch, so platform sizes cannot drift.
 */
function EditorBody({
  post,
  dayIndex,
  siblings = [],
  llm,
  user,
  availableImages = [],
  onSave,
  onClose,
  headerExtra,
  actions,
  wide,
  onDuplicatePost,
  onApprovePost,
}: Props) {
  const spec = specFor(post.platform);

  const authorName = user?.name || user?.email?.split('@')[0] || 'Creator';
  const authorHandle = user?.screenName || user?.email?.split('@')[0] || 'creator';

  const [content, setContent] = useState(post.content || '');
  const [mediaUrl, setMediaUrl] = useState(post.mediaUrl || '');
  // A datetime-local input is LOCAL time: render the UTC timestamp in the user's local zone.
  // Showing UTC here made the field several hours off and made edits round-trip incorrectly.
  const [scheduledTime, setScheduledTime] = useState(() => {
    if (!post.scheduledTime) return '';
    const d = new Date(post.scheduledTime);
    if (Number.isNaN(d.getTime())) return '';
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  });
  const [tags, setTags] = useState<{ name: string; urn: string }[]>(
    Array.isArray((post as any).taggedUsers) ? (post as any).taggedUsers : []
  );

  const [busy, setBusy] = useState<Busy>(null);
  const [note, setNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hashtagIdeas, setHashtagIdeas] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [tagName, setTagName] = useState('');
  const [quality, setQuality] = useState(llm?.imageQuality || 'low');
  // The prompt is treated as a brief by the server: it is fine-tuned before the image model sees it.
  const [imagePrompt, setImagePrompt] = useState(post.mediaPrompt || '');
  // Four ways to get the image: generate, reference, upload, library
  const [imageMode, setImageMode] = useState<'generate' | 'reference' | 'upload' | 'library'>(
    post.referenceUrls?.length ? 'reference' : 'generate'
  );
  const [customImageUrl, setCustomImageUrl] = useState('');
  const [showDuplicateModal, setShowDuplicateModal] = useState(false);
  const [dupDate, setDupDate] = useState(() => new Date(Date.now() + 86400000).toISOString().split('T')[0]);
  const [dupTime, setDupTime] = useState('14:00');
  const [dupAutoSchedule, setDupAutoSchedule] = useState(true);
  const [dupBusy, setDupBusy] = useState(false);
  const [referenceUrls, setReferenceUrls] = useState<string[]>(post.referenceUrls || []);
  const [lastPromptUsed, setLastPromptUsed] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const refFileRef = useRef<HTMLInputElement | null>(null);

  const overLimit = content.length > spec.maxChars;

  const run = async (kind: Busy, fn: () => Promise<void>) => {
    setBusy(kind);
    setError(null);
    setNote(null);
    try {
      await fn();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(null);
    }
  };

  const postJson = async (url: string, body: any) => {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || `request failed (HTTP ${res.status})`);
    return data;
  };

  // ---- copy ----
  const regenerateContent = () =>
    run('content', async () => {
      const d = await postJson('/api/calendar/posts/regenerate', {
        postId: post.id,
        target: 'content',
        provider: llm?.provider,
        apiKey: llm?.apiKey,
      });
      setContent(d.content);
      setNote(
        `Copy regenerated by ${d.provider} (${d.content.length} chars${d.truncated ? ', trimmed to the platform limit' : ''}) and saved.`
      );
    });

  const suggestHashtags = () =>
    run('hashtags', async () => {
      const d = await postJson('/api/calendar/posts/regenerate', {
        postId: post.id,
        target: 'hashtags',
        provider: llm?.provider,
        apiKey: llm?.apiKey,
      });
      setHashtagIdeas(d.hashtags || []);
      setNote(
        d.hashtags?.length
          ? `${d.hashtags.length} hashtag suggestion(s) from ${d.provider} — click one to add it to the post.`
          : 'The model returned no hashtags.'
      );
    });

  const addHashtag = (h: string) => {
    if (content.includes(h)) {
      setContent(content.replace(new RegExp(`\\s*${h}\\b`, 'g'), '').trim());
      setNote(`${h} removed from the copy.`);
    } else {
      setContent(`${content.trimEnd()} ${h}`.trim());
      setNote(`${h} added to the copy.`);
    }
  };

  // ---- image ----
  const regenerateImage = (mode: 'generate' | 'reference' = 'generate') =>
    run('image', async () => {
      const d = await postJson('/api/calendar/posts/regenerate', {
        postId: post.id,
        target: 'image',
        mode,
        imageApiKey: llm?.imageApiKey,
        imageQuality: quality,
        imagePrompt: imagePrompt.trim() || undefined,
      });
      setMediaUrl(d.mediaUrl);
      if (d.prompt) {
        setImagePrompt(d.prompt);
        setLastPromptUsed(d.prompt);
      }
      onSave(dayIndex, post.id, { mediaUrl: d.mediaUrl });
      setNote(
        `Image ${d.imageMode === 'reference' ? `generated from your ${d.references} input image(s)` : 'generated'} at ${d.width}×${d.height}${d.size ? ` (${d.size})` : ''} (${(d.bytes / 1048576).toFixed(2)} MB, quality ${d.quality}` +
          `${d.mode === 'resize' ? ', the shape already matched so it is a straight resize' : d.mode ? `, fitted whole into the frame (${d.content} shown, ${d.bandPx}px blurred edge) - nothing cropped` : ', NOT resized'}` +
          `) and saved to the post.` +
          (d.promptSource ? ` Prompt: ${d.promptSource}.` : '') +
          (d.promptRefined ? ' Your brief was fine-tuned into the prompt below.' : '') +
          (d.note ? ` ${d.note}.` : '')
      );
    });

  /** Mode 3a: store the user's input image(s) with the post - the model generates from them later. */
  const uploadReferences = (files: FileList) =>
    run('upload', async () => {
      const form = new FormData();
      form.append('postId', post.id);
      Array.from(files).forEach((f) => form.append('file', f));
      const res = await fetch('/api/calendar/posts/reference', { method: 'POST', body: form });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || `upload failed (HTTP ${res.status})`);
      setReferenceUrls(d.referenceUrls || []);
      onSave(dayIndex, post.id, { referenceUrls: d.referenceUrls || [] } as Partial<PostItem>);
      setNote(`${d.note} Now press "Generate from my image".`);
    });

  const removeReference = (url: string) =>
    run('upload', async () => {
      const res = await fetch('/api/calendar/posts/reference', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ postId: post.id, url }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || `could not remove it (HTTP ${res.status})`);
      setReferenceUrls(d.referenceUrls || []);
      onSave(dayIndex, post.id, { referenceUrls: d.referenceUrls || [] } as Partial<PostItem>);
      setNote(d.note || 'Removed.');
    });

  const uploadImage = (file: File) =>
    run('upload', async () => {
      const form = new FormData();
      form.append('postId', post.id);
      form.append('file', file);
      const res = await fetch('/api/calendar/posts/upload', { method: 'POST', body: form });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || `upload failed (HTTP ${res.status})`);
      setMediaUrl(d.mediaUrl);
      onSave(dayIndex, post.id, { mediaUrl: d.mediaUrl });
      setNote(`Uploaded ${d.originalName || 'image'} (${(d.bytes / 1024).toFixed(0)} KB) and saved to the post.`);
    });

  // ---- tags ----
  const addTag = () =>
    run('tag', async () => {
      const d = await postJson('/api/linkedin/resolve-tag', { input: tagInput, name: tagName });
      const next = [...tags.filter((t) => t.urn !== d.urn), { name: tagName || d.urn.replace('urn:li:person:', ''), urn: d.urn }];
      setTags(next);
      setTagInput('');
      setTagName('');
      onSave(dayIndex, post.id, { taggedUsers: next } as Partial<PostItem>);
      setNote(`${d.urn} added. ${d.note}`);
    });

  const removeTag = (urn: string) => {
    const next = tags.filter((t) => t.urn !== urn);
    setTags(next);
    onSave(dayIndex, post.id, { taggedUsers: next } as Partial<PostItem>);
    setNote(`${urn} removed from this post.`);
  };

  const saveAll = () =>
    run('save', async () => {
      if (overLimit) throw new Error(`copy is ${content.length} chars — ${spec.label} allows ${spec.maxChars}`);
      onSave(dayIndex, post.id, {
        content,
        mediaUrl: mediaUrl || null,
        scheduledTime: scheduledTime ? new Date(scheduledTime).toISOString() : post.scheduledTime,
        taggedUsers: tags,
      } as Partial<PostItem>);
      setNote('Saved.');
    });

  const btn = 'flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors disabled:opacity-50';

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-slate-900/60 backdrop-blur-sm p-4 overflow-y-auto">
      <div className={`w-full ${wide ? 'max-w-6xl' : 'max-w-2xl'} bg-white border border-slate-200 rounded-2xl shadow-2xl my-6 overflow-hidden`}>
        {/* header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-white">
          <div className="flex items-center gap-2.5">
            <span className="text-base font-semibold text-slate-900">{post.platform}</span>
            <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200/60">
              DAY {dayIndex}
            </span>
            <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-700 border border-slate-200">
              {post.status}
            </span>
            <span className="text-xs text-slate-500">
              {spec.label} · max {spec.maxChars} chars · {spec.hashtags} hashtags
            </span>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 font-medium text-xs px-2.5 py-1 rounded-lg hover:bg-slate-100 transition-colors">
            Close ✕
          </button>
        </div>

        {headerExtra && (
          <div className="px-6 py-3 border-b border-slate-100 bg-slate-50/80">{headerExtra}</div>
        )}

        <div className="p-6 flex flex-col gap-6">
          {/* copy */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="text-xs font-semibold text-slate-700 uppercase tracking-wider">Post copy</div>
              <div className="flex items-center gap-2">
                <span className={`text-xs font-medium ${overLimit ? 'text-rose-600 font-bold' : 'text-slate-500'}`}>
                  {content.length}/{spec.maxChars}
                </span>
                <button
                  onClick={regenerateContent}
                  disabled={busy !== null}
                  className={`${btn} border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100`}
                >
                  {busy === 'content' ? 'Regenerating…' : 'Regenerate content'}
                </button>
                <button
                  onClick={suggestHashtags}
                  disabled={busy !== null}
                  className={`${btn} border-slate-200 bg-white text-slate-700 hover:bg-slate-50 shadow-sm`}
                >
                  {busy === 'hashtags' ? 'Thinking…' : 'Suggest hashtags'}
                </button>
              </div>
            </div>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={9}
              className={`w-full bg-slate-50 border rounded-xl p-3 text-sm text-slate-900 focus:bg-white focus:outline-none transition-all ${
                overLimit ? 'border-rose-400 focus:ring-2 focus:ring-rose-200' : 'border-slate-200 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500'
              }`}
            />
            {hashtagIdeas.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {hashtagIdeas.map((h) => (
                  <button
                    key={h}
                    onClick={() => addHashtag(h)}
                    title={content.includes(h) ? 'click to remove from the copy' : 'click to add to the copy'}
                    className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
                      content.includes(h)
                        ? 'border-emerald-300 bg-emerald-50 text-emerald-700'
                        : 'border-slate-200 bg-white text-slate-700 hover:border-blue-300 hover:text-blue-600'
                    }`}
                  >
                    {h}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* image */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
                Image <span className="text-slate-500 normal-case font-normal">({spec.imageSize[0]}×{spec.imageSize[1]} · {spec.ratio} for {spec.label})</span>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                {imageMode !== 'upload' && (
                  <select
                    value={quality}
                    onChange={(e) => setQuality(e.target.value)}
                    className="bg-white border border-slate-200 rounded-lg px-2.5 py-1 text-xs text-slate-700 shadow-sm focus:outline-none focus:border-blue-500"
                  >
                    {['low', 'medium', 'high'].map((q) => (
                      <option key={q} value={q}>
                        {q} {QUALITY_COST[q]}
                      </option>
                    ))}
                  </select>
                )}

                {imageMode === 'generate' && (
                  <button
                    onClick={() => regenerateImage('generate')}
                    disabled={busy !== null}
                    className={`${btn} border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100`}
                  >
                    {busy === 'image' ? 'Generating…' : 'Generate image'}
                  </button>
                )}

                {imageMode === 'reference' && (
                  <>
                    <button
                      onClick={() => refFileRef.current?.click()}
                      disabled={busy !== null}
                      className={`${btn} border-slate-200 bg-white text-slate-700 hover:bg-slate-50 shadow-sm`}
                    >
                      {busy === 'upload' ? 'Uploading…' : 'Upload input image(s)'}
                    </button>
                    <input
                      ref={refFileRef}
                      type="file"
                      accept="image/png,image/jpeg,image/gif"
                      multiple
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files;
                        if (f && f.length) uploadReferences(f);
                        e.target.value = '';
                      }}
                    />
                    <button
                      onClick={() => regenerateImage('reference')}
                      disabled={busy !== null || referenceUrls.length === 0}
                      title={referenceUrls.length ? 'The model generates the postable image from your input image(s)' : 'Upload an input image first'}
                      className={`${btn} border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100 disabled:opacity-40`}
                    >
                      {busy === 'image' ? 'Generating…' : 'Generate from my image'}
                    </button>
                  </>
                )}

                {imageMode === 'upload' && (
                  <>
                    <button
                      onClick={() => fileRef.current?.click()}
                      disabled={busy !== null}
                      className={`${btn} border-slate-200 bg-white text-slate-700 hover:bg-slate-50 shadow-sm`}
                    >
                      {busy === 'upload' ? 'Uploading…' : 'Upload the final image'}
                    </button>
                    <input
                      ref={fileRef}
                      type="file"
                      accept="image/png,image/jpeg,image/gif"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) uploadImage(f);
                        e.target.value = '';
                      }}
                    />
                  </>
                )}
              </div>
            </div>

            {/* the four ways to get an image on this post */}
            <div className="flex items-center gap-1.5 flex-wrap mb-1.5">
              {([
                ['generate', '1 · Model generates it', "The model writes the image prompt from this post's copy and context, then generates."],
                ['reference', '2 · Generate from my input image', "Upload a photo or reference; the model generates the postable image FROM it, at this platform's size."],
                ['upload', '3 · I upload the finished image', 'You already have the final picture — it is used as-is, no generation.'],
                ['library', '4 · Choose from generated library', 'Pick from already generated images across this campaign or enter an image URL.'],
              ] as const).map(([m, label, hint]) => (
                <button
                  key={m}
                  onClick={() => setImageMode(m)}
                  title={hint}
                  className={`px-3 py-1 rounded-lg border text-xs font-medium transition-colors ${
                    imageMode === m
                      ? 'bg-blue-50 border-blue-300 text-blue-700 shadow-sm'
                      : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:text-slate-800'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="text-xs text-slate-500 mb-2">
              {imageMode === 'generate' &&
                (imagePrompt.trim()
                  ? 'Your prompt is fine-tuned into a production prompt, then the model generates at this platform\'s own frame.'
                  : 'No prompt? The model reads the post copy and context and writes the image prompt itself.')}
              {imageMode === 'reference' &&
                (referenceUrls.length
                  ? `${referenceUrls.length} input image(s) on this post — the model generates the postable image FROM them at this platform's size, following the input closely (input fidelity: high). Say what must stay in the prompt below; a vague prompt lets the model reinterpret your picture.`
                  : 'Upload the image(s) the model must work from (PNG, JPG or GIF, up to 6, 8 MB each). With no prompt it keeps your subject, composition and palette and only cleans it up.')}
              {imageMode === 'upload' && 'The file replaces this post\'s image as-is. Nothing is generated, so nothing is cropped.'}
              {imageMode === 'library' && 'Reuse an already generated image from your campaign, or enter a direct image URL.'}
            </div>

            {imageMode === 'library' && (
              <div className="flex flex-col gap-3 mb-3 bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-800">Campaign Generated Image Library</span>
                  <span className="text-[11px] text-slate-500 font-medium">{availableImages.length} image(s) available</span>
                </div>

                {availableImages.length > 0 ? (
                  <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2.5 max-h-48 overflow-y-auto p-1">
                    {availableImages.map((imgUrl, idx) => {
                      const isSelected = mediaUrl === imgUrl;
                      return (
                        <button
                          key={imgUrl + idx}
                          type="button"
                          onClick={() => {
                            setMediaUrl(imgUrl);
                            onSave(dayIndex, post.id, { mediaUrl: imgUrl });
                            setNote('Applied selected image from campaign library.');
                          }}
                          className={`relative aspect-square rounded-xl overflow-hidden border-2 transition-all group bg-white shadow-2xs cursor-pointer ${
                            isSelected
                              ? 'border-blue-600 ring-2 ring-blue-500/20'
                              : 'border-slate-200 hover:border-slate-400'
                          }`}
                          title="Click to apply this image"
                        >
                          <img src={imgUrl} alt="Library visual" className="w-full h-full object-cover" />
                          {isSelected && (
                            <span className="absolute top-1 right-1 bg-blue-600 text-white rounded-full p-0.5 shadow-xs">
                              <Check size={10} />
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-xs text-slate-500 italic">No other images generated in this campaign yet. You can paste an image URL below or generate with the tabs above.</p>
                )}

                <div className="flex items-center gap-2 pt-2 border-t border-slate-200/80">
                  <input
                    type="url"
                    value={customImageUrl}
                    onChange={(e) => setCustomImageUrl(e.target.value)}
                    placeholder="https://... or paste direct image URL"
                    className="flex-1 bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (!customImageUrl.trim()) return;
                      setMediaUrl(customImageUrl.trim());
                      onSave(dayIndex, post.id, { mediaUrl: customImageUrl.trim() });
                      setNote('Applied custom image URL to post.');
                      setCustomImageUrl('');
                    }}
                    className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-xs transition-colors shrink-0"
                  >
                    Apply URL
                  </button>
                </div>
              </div>
            )}

            {imageMode === 'reference' && referenceUrls.length > 0 && (
              <div className="flex items-center gap-2 flex-wrap mb-2">
                {referenceUrls.map((u) => (
                  <span key={u} className="relative inline-block">
                    <img
                      src={u}
                      alt="your input image"
                      title="your input image — click the × to remove it"
                      className="w-16 h-16 object-contain rounded-lg border border-slate-200 bg-slate-50"
                    />
                    <button
                      onClick={() => removeReference(u)}
                      disabled={busy !== null}
                      title="remove this input image"
                      className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-white border border-slate-300 text-slate-500 hover:text-rose-600 shadow-sm text-xs flex items-center justify-center leading-none"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}

            {imageMode !== 'upload' && (
            <div className="mb-2">
              <div className="text-xs text-slate-500 mb-1">
                {imageMode === 'reference'
                  ? 'How should the model use your input image? Name what must stay ("keep the product and the layout, only replace the background") — it is fine-tuned and aimed at this platform\'s own frame. Leave it empty and it preserves the subject, composition and palette. The whole picture is kept — it is never cropped.'
                  : 'Image prompt — describe what you want. I fine-tune it (subject, setting, light, style, "no text in the image") and aim it at this platform\'s own frame before it reaches the image model. The whole picture is kept — it is never cropped.'}
              </div>
              <textarea
                value={imagePrompt}
                onChange={(e) => setImagePrompt(e.target.value)}
                rows={2}
                placeholder="e.g. a founder's desk at sunrise, laptop open, coffee, warm light, shallow depth of field"
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              />
              <div className="text-[11px] text-slate-400 mt-1">
                {lastPromptUsed
                  ? `the prompt actually sent: ${lastPromptUsed.slice(0, 140)}${lastPromptUsed.length > 140 ? '…' : ''}`
                  : imageMode === 'reference'
                  ? 'leave it empty and I write a transform instruction from the post copy'
                  : 'leave it empty and the model writes the prompt from this post'}
              </div>
            </div>
            )}
            {mediaUrl ? (
              <img src={mediaUrl} alt="post visual" className="w-full max-h-72 object-contain bg-slate-100 rounded-xl border border-slate-200" />
            ) : (
              <div className="h-24 flex items-center justify-center bg-slate-50 border border-dashed border-slate-300 rounded-xl text-xs text-slate-400">
                no image on this post — generate or upload one
              </div>
            )}
            <div className="text-xs text-slate-500 mt-1.5">
              PNG, JPG or GIF. LinkedIn rejects WebP, so it is refused at upload rather than failing at publish.
            </div>
          </div>

          {/* tags */}
          <div>
            <div className="text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
              Tag people{' '}
              <span className="text-slate-500 normal-case font-normal">
                (LinkedIn renders a mention only if you are connected to them — its People Search API is partner-only, so the id must be pasted)
              </span>
            </div>
            <div className="flex gap-2">
              <input
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                placeholder="profile URL with the id, a member id, or urn:li:person:…"
                className="flex-1 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              />
              <input
                value={tagName}
                onChange={(e) => setTagName(e.target.value)}
                placeholder="display name"
                className="w-40 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              />
              <button
                onClick={addTag}
                disabled={busy !== null || !tagInput.trim()}
                className={`${btn} border-slate-200 bg-white text-slate-700 hover:bg-slate-50 shadow-sm`}
              >
                {busy === 'tag' ? 'Resolving…' : 'Add tag'}
              </button>
            </div>
            {tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {tags.map((t) => (
                  <span
                    key={t.urn}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border border-blue-200 bg-blue-50 text-blue-700"
                  >
                    {t.name || t.urn}
                    <span className="text-blue-500 text-[10px]">{t.urn.replace('urn:li:person:', '')}</span>
                    <button onClick={() => removeTag(t.urn)} className="text-blue-400 hover:text-rose-600">
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* schedule */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="text-xs font-semibold text-slate-700 uppercase tracking-wider">Scheduled Day & Timing</div>
              {post.status === 'APPROVED' || post.status === 'SCHEDULED' ? (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Armed for Automated Publishing
                </span>
              ) : (
                <span className="text-[11px] text-amber-600 font-medium bg-amber-50 px-2.5 py-0.5 rounded-full border border-amber-200">
                  Pending Approval (Not automated yet)
                </span>
              )}
            </div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <input
                type="datetime-local"
                value={scheduledTime}
                onChange={(e) => setScheduledTime(e.target.value)}
                className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-mono"
              />
              {post.status !== 'APPROVED' && post.status !== 'SCHEDULED' && onApprovePost && (
                <button
                  type="button"
                  onClick={() => {
                    const stIso = scheduledTime ? new Date(scheduledTime).toISOString() : post.scheduledTime;
                    onSave(dayIndex, post.id, {
                      content,
                      mediaUrl: mediaUrl || null,
                      scheduledTime: stIso,
                      status: 'APPROVED',
                    });
                    setNote('Armed for automated publishing at the scheduled day & time!');
                  }}
                  className="px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Check size={13} />
                  <span>Arm for Automated Publishing</span>
                </button>
              )}
              {post.status === 'APPROVED' && (
                <button
                  type="button"
                  onClick={() => {
                    onSave(dayIndex, post.id, { status: 'PENDING_APPROVAL' });
                    setNote('Paused automated publishing — moved back to Draft.');
                  }}
                  className="px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium transition-colors cursor-pointer"
                >
                  Pause Schedule (Draft)
                </button>
              )}
            </div>
            <p className="text-[11px] text-slate-500 mt-1">
              {post.status === 'APPROVED' || post.status === 'SCHEDULED'
                ? 'The automated background scheduler will automatically publish this post when this exact day and timing is reached.'
                : 'Set your desired day & time, then click "Arm for Automated Publishing" to schedule automated posting.'}
            </p>
          </div>

          {/* how it will actually look, per platform */}
          <div>
            <div className="text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
              Preview <span className="text-slate-500 normal-case font-normal">(updates as you type — same copy, each platform&apos;s own frame, image ratio and truncation)</span>
            </div>
            <PlatformPreview
              content={content}
              mediaUrl={mediaUrl}
              ownPlatform={post.platform}
              siblings={siblings.filter((x) => x.id !== post.id)}
              authorName={authorName}
              authorHandle={authorHandle}
            />
          </div>

          {note && <div className="text-xs font-medium text-emerald-600 bg-emerald-50 border border-emerald-200 px-3 py-2 rounded-lg leading-relaxed">{note}</div>}
          {error && <div className="text-xs font-medium text-rose-600 bg-rose-50 border border-rose-200 px-3 py-2 rounded-lg leading-relaxed">NOT saved: {error}</div>}

          <div className="flex items-center justify-between gap-2 border-t border-slate-100 pt-4 flex-wrap bg-slate-50/50 -mx-6 -mb-6 px-6 py-4 rounded-b-2xl">
            <div className="flex items-center gap-2 flex-wrap">
              {actions}
              {onDuplicatePost && (
                <button
                  type="button"
                  onClick={() => setShowDuplicateModal(true)}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-xs font-medium shadow-xs transition-colors cursor-pointer"
                  title="Duplicate this post with its content and image to another day and timing"
                >
                  <Copy size={13} /> Duplicate to Another Day
                </button>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={saveAll}
                disabled={busy !== null || overLimit}
                className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium shadow-sm transition-colors disabled:opacity-50 cursor-pointer"
              >
                {busy === 'save' ? 'Saving…' : 'Save changes'}
              </button>
              <button onClick={onClose} className="px-4 py-2 rounded-lg bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-medium shadow-sm transition-colors cursor-pointer">
                Close
              </button>
            </div>
          </div>
        </div>

        {/* Duplicate Post Dialog Modal */}
        {showDuplicateModal && (
          <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
            <div className="w-full max-w-sm bg-white rounded-2xl border border-slate-200 shadow-2xl p-5 flex flex-col gap-4 animate-in fade-in zoom-in-95 duration-150">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <Copy size={15} className="text-blue-600" />
                  <span className="font-bold text-sm text-slate-900">Duplicate to Another Day</span>
                </div>
                <button
                  type="button"
                  onClick={() => setShowDuplicateModal(false)}
                  className="text-slate-400 hover:text-slate-700 text-xs font-bold"
                >
                  ✕
                </button>
              </div>

              <p className="text-xs text-slate-600 leading-relaxed">
                Create a duplicate of this <strong className="text-slate-800">{post.platform}</strong> post (including its copy and image) scheduled on a different day and timing.
              </p>

              <div className="flex flex-col gap-3">
                <div>
                  <label className="block text-[11px] font-bold uppercase text-slate-500 mb-1">Target Date</label>
                  <input
                    type="date"
                    value={dupDate}
                    onChange={(e) => setDupDate(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold uppercase text-slate-500 mb-1">Target Timing</label>
                  <input
                    type="time"
                    value={dupTime}
                    onChange={(e) => setDupTime(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 font-mono"
                  />
                </div>

                <label className="flex items-start gap-2 cursor-pointer bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                  <input
                    type="checkbox"
                    checked={dupAutoSchedule}
                    onChange={(e) => setDupAutoSchedule(e.target.checked)}
                    className="mt-0.5 rounded text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-xs text-slate-700">
                    <strong>Arm for Automated Publishing</strong>
                    <br />
                    <span className="text-[11px] text-slate-500">Scheduler will automatically post on that day and time</span>
                  </span>
                </label>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowDuplicateModal(false)}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-medium text-slate-600 hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={dupBusy || !dupDate}
                  onClick={async () => {
                    setDupBusy(true);
                    try {
                      if (onDuplicatePost) {
                        await onDuplicatePost(post, dupDate, dupTime, dupAutoSchedule);
                        setShowDuplicateModal(false);
                        onClose();
                      }
                    } finally {
                      setDupBusy(false);
                    }
                  }}
                  className="px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-xs disabled:opacity-50 cursor-pointer"
                >
                  {dupBusy ? 'Duplicating…' : 'Duplicate & Schedule'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}


/* ---------------------------------------------------------------------------------------------------
 * Group mode — this is what a card in the post list opens.
 *
 * One tab per platform post of that day; each tab edits ITS OWN post. The body is keyed by post id, so
 * switching tabs can never carry one platform's copy, image or result line into another platform's tab.
 * ------------------------------------------------------------------------------------------------- */

const TAB_ICON: Record<string, React.ReactNode> = {
  LINKEDIN: <Linkedin size={13} className="text-blue-500" />,
  TWITTER: <Twitter size={13} className="text-sky-400" />,
  INSTAGRAM: <Instagram size={13} className="text-pink-500" />,
};

const DOT: Record<string, string> = {
  PENDING_APPROVAL: 'bg-amber-400',
  APPROVED: 'bg-blue-500',
  SCHEDULED: 'bg-blue-500',
  PUBLISHED: 'bg-emerald-500',
};

export interface PostEditorModalProps {
  post: PostItem;
  /** Every post on that day: they become the tabs. Falls back to just `post`. */
  group?: PostItem[];
  dayIndex: number;
  llm?: { provider?: string; apiKey?: string; imageApiKey?: string; imageQuality?: string };
  user?: UserSession;
  availableImages?: string[];
  onSave: (dayIndex: number, postId: string, fields: Partial<PostItem>) => void;
  onClose: () => void;
  onApprovePost?: (post: PostItem) => void;
  onDispatchPost?: (post: PostItem) => void;
  onDeletePost?: (post: PostItem) => void;
  onDuplicatePost?: (sourcePost: PostItem, targetDate: string, targetTime: string, autoSchedule: boolean) => Promise<void>;
  publishingId?: string | null;
}

export default function PostEditorModal({
  post,
  group,
  dayIndex,
  llm,
  user,
  availableImages,
  onSave,
  onClose,
  onApprovePost,
  onDispatchPost,
  onDeletePost,
  onDuplicatePost,
  publishingId,
}: PostEditorModalProps) {
  const posts = (group && group.length ? group : [post])
    .slice()
    .sort((a, b) => new Date(a.scheduledTime).getTime() - new Date(b.scheduledTime).getTime());
  const [activeId, setActiveId] = useState(post.id);
  const active = posts.find((p) => p.id === activeId) || post;
  const pending = posts.filter((p) => p.status === 'PENDING_APPROVAL').length;

  const tabs = (
    <div className="flex items-center gap-2 flex-wrap">
      <span className="text-xs text-slate-500 font-medium">
        {posts.length} platform post{posts.length === 1 ? '' : 's'} on day {dayIndex}
        {pending ? ` · ${pending} pending approval` : ''}
      </span>
      <span className="h-4 w-px bg-slate-200" />
      {posts.map((p) => {
        const on = p.id === active.id;
        return (
          <button
            key={p.id}
            onClick={() => setActiveId(p.id)}
            title={`${p.platform} · ${p.status} · ${new Date(p.scheduledTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors ${
              on
                ? 'bg-blue-50 border-blue-300 text-blue-700 shadow-sm'
                : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-900'
            }`}
          >
            {TAB_ICON[p.platform]}
            {p.platform}
            <span className={`w-1.5 h-1.5 rounded-full ${DOT[p.status] || 'bg-slate-400'}`} />
          </button>
        );
      })}
    </div>
  );

  const actions = (
    <>
      {onApprovePost && active.status === 'PENDING_APPROVAL' && (
        <button
          onClick={() => onApprovePost(active)}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-medium shadow-sm transition-colors cursor-pointer"
        >
          <Check size={13} /> Approve {active.platform}
        </button>
      )}
      {onDispatchPost && active.status !== 'PUBLISHED' && (
        <button
          onClick={() => onDispatchPost(active)}
          disabled={publishingId === active.id}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium shadow-sm transition-colors disabled:opacity-50 cursor-pointer"
          title="Posts to the real account now (asks for confirmation)"
        >
          <Send size={13} /> {publishingId === active.id ? 'Dispatching…' : `Dispatch ${active.platform} now`}
        </button>
      )}
      {onDeletePost && active.status !== 'PUBLISHED' && (
        <button
          onClick={() => onDeletePost(active)}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white hover:bg-rose-50 border border-slate-200 hover:border-rose-200 text-slate-600 hover:text-rose-600 text-xs font-medium shadow-sm transition-colors cursor-pointer"
        >
          <Trash2 size={13} /> Remove {active.platform}
        </button>
      )}
    </>
  );

  return (
    <EditorBody
      key={active.id}
      post={active}
      dayIndex={dayIndex}
      siblings={posts}
      llm={llm}
      user={user}
      availableImages={availableImages}
      onSave={onSave}
      onClose={onClose}
      onApprovePost={onApprovePost}
      onDuplicatePost={onDuplicatePost}
      headerExtra={tabs}
      actions={actions}
      wide={posts.length > 1}
    />
  );
}
