import { defineRouteConfig } from "@medusajs/admin-sdk";
import { useEffect, useId, useRef, useState, type CSSProperties } from "react";
import { useBlocker } from "react-router-dom";
import { adminRequest } from "../../lib/inline-edit";
import type { HomepageContent } from "../../../lib/storefront-content/schema";
import type { HomepageState } from "../../../lib/storefront-content/store";
import "./storefront.css";
import { LinkPickerProvider, StorefrontLinkPicker } from "./link-picker";
import { RustyHelper } from "./rusty-helper";
type State = HomepageState & { storefront_url: string };
type Hero = HomepageContent["hero"];
type Card = HomepageContent["explore"]["items"][number];
const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value));
function HeroBoxControls({
  value,
  change,
}: {
  value: Hero;
  change: (patch: Partial<Hero>) => void;
}) {
  const opacityId = useId(),
    helpId = useId();
  return (
    <fieldset className="hp-box-controls" disabled={!value.showText}>
      <legend>Text box appearance</legend>
      <label className="hp-field" htmlFor={opacityId}>
        <span>
          Text box background opacity{" "}
          <output htmlFor={opacityId}>{value.textBoxOpacity ?? 93}%</output>
        </span>
        <input
          id={opacityId}
          type="range"
          min="0"
          max="100"
          step="1"
          aria-label="Text box background opacity"
          aria-describedby={helpId}
          value={value.textBoxOpacity ?? 93}
          onChange={(e) => change({ textBoxOpacity: Number(e.target.value) })}
        />
        <small id={helpId}>
          0% is fully clear; 100% is solid white. Only the background fades.
          Check that the words are easy to read over your photo.
        </small>
      </label>
      <label className="hp-field">
        <span>Text box size</span>
        <select
          aria-label="Text box size"
          value={value.textBoxSize || "standard"}
          onChange={(e) =>
            change({ textBoxSize: e.target.value as Hero["textBoxSize"] })
          }
        >
          <option value="compact">Compact</option>
          <option value="standard">Standard</option>
          <option value="wide">Wide</option>
        </select>
        <small>
          The box grows with your text. These settings control the desktop
          overlay; on phones, text stays full-width below the photo.
        </small>
      </label>
    </fieldset>
  );
}
function publicImage(path: string, origin: string) {
  return path.startsWith("/") ? origin.replace(/\/$/, "") + path : path;
}
function TextField({
  label,
  value,
  onChange,
  help,
  required = false,
  multiline = false,
  max = 160,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  help?: string;
  required?: boolean;
  multiline?: boolean;
  max?: number;
}) {
  const helpId = useId();
  return (
    <label className="hp-field">
      <span>
        {label}
        {required && <em className="hp-required">Required</em>}
      </span>
      {multiline ? (
        <textarea
          aria-label={label}
          aria-describedby={help ? helpId : undefined}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={3}
          maxLength={max}
          required={required}
        />
      ) : (
        <input
          aria-label={label}
          aria-describedby={help ? helpId : undefined}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          maxLength={max}
          required={required}
        />
      )}{" "}
      {help && <small id={helpId}>{help}</small>}
      <small className="hp-character-count">
        {value.length} / {max} characters
      </small>
    </label>
  );
}
function Toggle({
  label,
  checked,
  onChange,
  help,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  help?: string;
}) {
  const helpId = useId();
  return (
    <label className="hp-toggle">
      <input
        aria-label={label}
        aria-describedby={help ? helpId : undefined}
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span>
        {label}
        {help && <small id={helpId}>{help}</small>}
      </span>
    </label>
  );
}
function Fit({
  value,
  onChange,
}: {
  value: "cover" | "contain";
  onChange: (fit: "cover" | "contain") => void;
}) {
  return (
    <label className="hp-field">
      <span>How should the image fit?</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as "cover" | "contain")}
      >
        <option value="cover">Fill the frame (edges may be cropped)</option>
        <option value="contain">
          Show the whole picture (may leave space)
        </option>
      </select>
    </label>
  );
}
function ImageField({
  label,
  url,
  origin,
  hint,
  onUpload,
}: {
  label: string;
  url: string;
  origin: string;
  hint: string;
  onUpload: (file: File) => void;
}) {
  return (
    <div className="hp-image-field">
      <div className="hp-image-thumb">
        {url ? (
          <img src={publicImage(url, origin)} alt={`${label} preview`} />
        ) : (
          <span>Uses the desktop image</span>
        )}
      </div>
      <div>
        <strong>{label}</strong>
        <p>{hint}</p>
        <label className="hp-upload-label">
          {url ? "Replace image" : "Upload image"}
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            aria-label={`Upload ${label}`}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) onUpload(file);
              e.target.value = "";
            }}
          />
        </label>
        <small>JPG, PNG or WebP · up to 8 MB</small>
      </div>
    </div>
  );
}
function CopyFields({
  value,
  change,
}: {
  value: Hero | Card;
  change: (patch: Partial<Hero & Card>) => void;
}) {
  return (
    <>
      <RustyHelper
        kind="section"
        context={{
          title: value.title,
          description: value.description,
          eyebrow: value.eyebrow,
          action: value.action,
          destination: value.href,
        }}
        apply={(patch) =>
          change({
            ...(patch.title !== undefined ? { title: patch.title } : {}),
            ...(patch.description !== undefined
              ? { description: patch.description }
              : {}),
            ...(patch.eyebrow !== undefined ? { eyebrow: patch.eyebrow } : {}),
            ...(patch.action !== undefined ? { action: patch.action } : {}),
          })
        }
      />
      <TextField
        label="Small label above the heading"
        value={value.eyebrow}
        onChange={(eyebrow) => change({ eyebrow })}
        max={100}
      />
      <TextField
        label="Heading"
        value={value.title}
        onChange={(title) => change({ title })}
        required
        multiline
        help="Keep a clear heading even when visible text is switched off."
      />
      <TextField
        label="Description"
        value={value.description}
        onChange={(description) => change({ description })}
        max={600}
        multiline
      />
      <div className="hp-fields-two">
        <StorefrontLinkPicker
          value={value.href}
          onChange={(href) => change({ href })}
        />
        <TextField
          label="Button text"
          value={value.action}
          onChange={(action) => change({ action })}
          max={80}
          required
          help="For example: Shop earrings. Also names the clickable image when website text is off."
        />
      </div>
    </>
  );
}
function Preview({
  content,
  origin,
  phone,
}: {
  content: HomepageContent;
  origin: string;
  phone: boolean;
}) {
  const hero = content.hero;
  return (
    <div className={`hp-preview-stage ${phone ? "phone" : ""}`}>
      <div className="hp-preview-brand">RUSTIC HALO</div>
      {hero.enabled && (
        <div className={`hp-preview-hero ${hero.showText ? "" : "image-only"}`}>
          <img
            src={publicImage(
              phone ? hero.mobileImage : hero.desktopImage,
              origin,
            )}
            alt={hero.imageAlt}
            style={{ objectFit: hero.imageFit }}
          />
          {hero.showText && (
            <div
              data-box-clear={
                (hero.textBoxOpacity ?? 93) === 0 ? "true" : undefined
              }
              style={
                {
                  "--hp-box-alpha": (hero.textBoxOpacity ?? 93) / 100,
                  "--hp-box-width":
                    { compact: "52%", standard: "62%", wide: "84%" }[
                      hero.textBoxSize
                    ] || "62%",
                  "--hp-box-padding":
                    hero.textBoxSize === "compact" ? "12px" : "17px",
                } as CSSProperties
              }
            >
              <small>{hero.eyebrow}</small>
              <h3>{hero.title}</h3>
              {hero.description && <p>{hero.description}</p>}
              <span>{hero.action} ↗</span>
            </div>
          )}
        </div>
      )}
      {content.explore.enabled && (
        <section className="hp-preview-explore">
          {content.explore.showHeading && <h3>{content.explore.heading}</h3>}
          {content.explore.items
            .filter((c) => c.enabled)
            .map((c) => (
              <article className={c.showText ? "" : "image-only"} key={c.id}>
                <img
                  src={publicImage(
                    phone && c.mobileImage ? c.mobileImage : c.image,
                    origin,
                  )}
                  alt={c.alt}
                  style={{ objectFit: c.imageFit }}
                />
                {c.showText && (
                  <div>
                    <small>{c.eyebrow}</small>
                    <h4>{c.title}</h4>
                    <p>{c.description}</p>
                    <span>{c.action} ↗</span>
                  </div>
                )}
              </article>
            ))}
        </section>
      )}
    </div>
  );
}
const StorefrontPage = () => {
  const [saved, setSaved] = useState<State | null>(null),
    [draft, setDraft] = useState<HomepageContent | null>(null),
    [tab, setTab] = useState<"hero" | "explore" | "seo">("hero"),
    [phone, setPhone] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  const form = useRef<HTMLFormElement>(null);
  const dirty =
    !!draft && !!saved && JSON.stringify(draft) !== JSON.stringify(saved.draft);
  const blocker = useBlocker(dirty);
  const unpublished =
    !!saved && JSON.stringify(saved.draft) !== JSON.stringify(saved.published);
  async function load() {
    setBusy(true);
    setError("");
    try {
      const data = (await adminRequest("/admin/storefront-content")) as State;
      setSaved(data);
      setDraft(clone(data.draft));
      setNotice("Saved homepage loaded.");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    void load();
  }, []);
  useEffect(() => {
    const guard = (e: BeforeUnloadEvent) => {
      if (dirty) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", guard);
    return () => window.removeEventListener("beforeunload", guard);
  }, [dirty]);
  function hero(patch: Partial<Hero>) {
    setDraft((d) => d && { ...d, hero: { ...d.hero, ...patch } });
  }
  function card(index: number, patch: Partial<Card>) {
    setDraft(
      (d) =>
        d && {
          ...d,
          explore: {
            ...d.explore,
            items: d.explore.items.map((c, i) =>
              i === index ? { ...c, ...patch } : c,
            ),
          },
        },
    );
  }
  async function upload(file: File, change: (url: string) => void) {
    if (
      file.size > 8_000_000 ||
      !["image/jpeg", "image/png", "image/webp"].includes(file.type)
    ) {
      setError("Choose a JPG, PNG or WebP image under 8 MB.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const content = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result).split(",")[1]);
        reader.onerror = () => reject(Error("Could not read this image."));
        reader.readAsDataURL(file);
      });
      const result = await adminRequest("/admin/storefront-content/upload", {
        content,
        filename: file.name,
      });
      change(result.url);
      setNotice(
        `Image ready: ${result.width} × ${result.height}. Save a draft or publish when you are ready.`,
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function save(action: "draft" | "publish") {
    if (!draft || !saved) return;
    if (!form.current?.checkValidity()) {
      const invalid = form.current?.querySelector(
        "input:invalid, textarea:invalid, select:invalid",
      ) as HTMLInputElement | null;
      const panel = invalid?.closest("[data-editor-tab]") as HTMLElement | null;
      if (panel?.dataset.editorTab)
        setTab(panel.dataset.editorTab as "hero" | "explore" | "seo");
      setError(
        "Complete the required fields in the selected section before saving.",
      );
      requestAnimationFrame(() => {
        const details = invalid?.closest("details");
        if (details) details.open = true;
        invalid?.reportValidity();
      });
      return;
    }
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const data = (await adminRequest("/admin/storefront-content", {
        content: draft,
        action,
        expected_revision: saved.revision,
      })) as State;
      setSaved(data);
      setDraft(clone(data.draft));
      setNotice(
        action === "publish"
          ? "Homepage published to this store. Refresh the storefront to see your changes."
          : "Draft saved. The published storefront has not changed.",
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <LinkPickerProvider origin={saved?.storefront_url || ""}>
      <div className="hp-editor">
        <header className="hp-header">
          <div>
            <span className="hp-kicker">STOREFRONT</span>
            <h1>Homepage editor</h1>
            <p>Fresh images and a few words. Your storefront, in your hands.</p>
          </div>
          <div className="hp-header-actions">
            <button
              type="button"
              disabled={busy || !dirty}
              onClick={() => {
                if (saved) {
                  setDraft(clone(saved.draft));
                  setError("");
                  setNotice("Unsaved changes discarded.");
                }
              }}
            >
              Discard changes
            </button>
            <button
              type="button"
              disabled={busy || !draft || !dirty}
              onClick={() => void save("draft")}
            >
              Save draft
            </button>
            <button
              className="hp-primary"
              type="button"
              disabled={busy || !draft}
              onClick={() => void save("publish")}
            >
              {busy ? "Working…" : "Publish to storefront"}
            </button>
          </div>
        </header>
        <div className="hp-status">
          <span className={dirty ? "is-dirty" : ""}>
            {dirty
              ? "Unsaved changes"
              : unpublished
                ? "Saved draft · not published"
                : "Published design"}
          </span>
          {saved?.published_at && (
            <span>
              Last published {new Date(saved.published_at).toLocaleString()}
            </span>
          )}
          {saved && (
            <a
              href={saved.storefront_url}
              target="_blank"
              rel="noopener noreferrer"
            >
              Open storefront ↗
            </a>
          )}
        </div>
        {notice && (
          <p className="hp-notice" role="status">
            {notice}
          </p>
        )}
        {error && (
          <div className="hp-error" role="alert">
            <p>{error}</p>
            <button type="button" disabled={busy} onClick={() => void load()}>
              Reload saved version
            </button>
          </div>
        )}
        {!saved && !busy && (
          <button type="button" onClick={() => void load()}>
            Load homepage
          </button>
        )}
        {draft && saved && (
          <div className="hp-editor-grid">
            <div>
              <nav className="hp-editor-tabs" aria-label="Homepage sections">
                {(["hero", "explore", "seo"] as const).map((t) => (
                  <button
                    type="button"
                    key={t}
                    aria-pressed={tab === t}
                    onClick={() => setTab(t)}
                  >
                    {t === "hero"
                      ? "Hero"
                      : t === "explore"
                        ? "Explore collections"
                        : "Search settings"}
                  </button>
                ))}
              </nav>
              <form ref={form} onSubmit={(e) => e.preventDefault()}>
                <fieldset disabled={busy}>
                  <section
                    className="hp-panel"
                    data-editor-tab="hero"
                    hidden={tab !== "hero"}
                  >
                    <h2>Hero</h2>
                    <p>
                      Your first impression. Use separate desktop and phone
                      crops.
                    </p>
                    <Toggle
                      label="Show hero section"
                      checked={draft.hero.enabled}
                      onChange={(enabled) => hero({ enabled })}
                    />
                    <Toggle
                      label="Show website text and button"
                      checked={draft.hero.showText}
                      onChange={(showText) => hero({ showText })}
                      help="Switch off for a full clickable image. Your saved text stays available."
                    />
                    <ImageField
                      label="Desktop hero image"
                      url={draft.hero.desktopImage}
                      origin={saved.storefront_url}
                      hint="2400 × 800 px recommended. Leave the left 40% quiet when text is on."
                      onUpload={(file) =>
                        void upload(file, (url) => hero({ desktopImage: url }))
                      }
                    />
                    <ImageField
                      label="Phone hero image"
                      url={draft.hero.mobileImage}
                      origin={saved.storefront_url}
                      hint="1200 × 800 px recommended. Center the products; text sits below the image."
                      onUpload={(file) =>
                        void upload(file, (url) => hero({ mobileImage: url }))
                      }
                    />
                    <TextField
                      label="Hero image description (alt text)"
                      value={draft.hero.imageAlt}
                      onChange={(imageAlt) => hero({ imageAlt })}
                      max={300}
                      required
                      help="Describe what the photo shows. Include meaningful words printed in the artwork; avoid a list of keywords."
                    />
                    <RustyHelper
                      kind="alt"
                      context={{
                        title: draft.hero.title,
                        description: draft.hero.description,
                        alt: draft.hero.imageAlt,
                        photo: draft.hero.desktopImage,
                      }}
                      apply={(patch) => {
                        if (patch.alt !== undefined)
                          hero({ imageAlt: patch.alt });
                      }}
                    />
                    <Fit
                      value={draft.hero.imageFit}
                      onChange={(imageFit) => hero({ imageFit })}
                    />
                    <details
                      className="hp-copy-fields"
                      open={draft.hero.showText}
                    >
                      <summary>
                        {draft.hero.showText
                          ? "Hero text and link"
                          : "Saved text and image link"}
                      </summary>
                      <HeroBoxControls value={draft.hero} change={hero} />
                      <CopyFields value={draft.hero} change={hero} />
                    </details>
                  </section>
                  <section
                    className="hp-panel"
                    data-editor-tab="explore"
                    hidden={tab !== "explore"}
                  >
                    <h2>Explore the collections</h2>
                    <p>
                      Update the two collection stories independently. Text can
                      be hidden without losing it.
                    </p>
                    <Toggle
                      label="Show Explore collections section"
                      checked={draft.explore.enabled}
                      onChange={(enabled) =>
                        setDraft({
                          ...draft,
                          explore: { ...draft.explore, enabled },
                        })
                      }
                    />
                    <Toggle
                      label="Show section heading"
                      checked={draft.explore.showHeading}
                      onChange={(showHeading) =>
                        setDraft({
                          ...draft,
                          explore: { ...draft.explore, showHeading },
                        })
                      }
                    />
                    <TextField
                      label="Section heading"
                      value={draft.explore.heading}
                      onChange={(heading) =>
                        setDraft({
                          ...draft,
                          explore: { ...draft.explore, heading },
                        })
                      }
                      max={100}
                      required
                    />
                    {draft.explore.items.map((c, i) => (
                      <section
                        className="hp-collection-editor"
                        key={c.id}
                        aria-label={`Collection ${i + 1} editor`}
                      >
                        <h3>
                          Collection {i + 1} · {c.title}
                        </h3>
                        <Toggle
                          label={`Show collection ${i + 1}`}
                          checked={c.enabled}
                          onChange={(enabled) => card(i, { enabled })}
                        />
                        <Toggle
                          label={`Show collection ${i + 1} text and button`}
                          checked={c.showText}
                          onChange={(showText) => card(i, { showText })}
                          help="When off, the image uses the full row and remains clickable."
                        />
                        <ImageField
                          label={`Collection ${i + 1} image`}
                          url={c.image}
                          origin={saved.storefront_url}
                          hint="Product photo: 1200 × 1000 px or larger. For a full-image row, use a wide 2400 × 800 px banner."
                          onUpload={(file) =>
                            void upload(file, (url) => card(i, { image: url }))
                          }
                        />
                        <ImageField
                          label={`Collection ${i + 1} phone image`}
                          url={c.mobileImage}
                          origin={saved.storefront_url}
                          hint="Optional separate phone crop. Leave empty to use the main image."
                          onUpload={(file) =>
                            void upload(file, (url) =>
                              card(i, { mobileImage: url }),
                            )
                          }
                        />
                        {c.mobileImage && (
                          <button
                            className="hp-text-button"
                            type="button"
                            onClick={() => card(i, { mobileImage: "" })}
                          >
                            Use main image on phones
                          </button>
                        )}
                        <TextField
                          label={`Collection ${
                            i + 1
                          } image description (alt text)`}
                          value={c.alt}
                          onChange={(alt) => card(i, { alt })}
                          max={300}
                          required
                        />
                        <RustyHelper
                          kind="alt"
                          context={{
                            title: c.title,
                            description: c.description,
                            alt: c.alt,
                            photo: c.image,
                          }}
                          apply={(patch) => {
                            if (patch.alt !== undefined)
                              card(i, { alt: patch.alt });
                          }}
                        />
                        <Fit
                          value={c.imageFit}
                          onChange={(imageFit) => card(i, { imageFit })}
                        />
                        <details className="hp-copy-fields" open={c.showText}>
                          <summary>
                            {c.showText
                              ? "Collection text and link"
                              : "Saved text and image link"}
                          </summary>
                          <CopyFields
                            value={c}
                            change={(patch) => card(i, patch)}
                          />
                        </details>
                      </section>
                    ))}
                  </section>
                  <section
                    className="hp-panel"
                    data-editor-tab="seo"
                    hidden={tab !== "seo"}
                  >
                    <h2>Search settings</h2>
                    <p>
                      Useful page information, even when your artwork contains
                      the visible headline.
                    </p>
                    <RustyHelper
                      kind="search"
                      context={{
                        title: draft.seo.title,
                        description: draft.seo.description,
                      }}
                      apply={(patch) =>
                        setDraft({
                          ...draft,
                          seo: {
                            title: patch.seoTitle ?? draft.seo.title,
                            description:
                              patch.seoDescription ?? draft.seo.description,
                          },
                        })
                      }
                    />
                    <TextField
                      label="Homepage search title"
                      value={draft.seo.title}
                      onChange={(title) =>
                        setDraft({ ...draft, seo: { ...draft.seo, title } })
                      }
                      max={100}
                      required
                      help="A clear name for the page. Around 50–60 characters is a useful starting point."
                    />
                    <TextField
                      label="Homepage search description"
                      value={draft.seo.description}
                      onChange={(description) =>
                        setDraft({
                          ...draft,
                          seo: { ...draft.seo, description },
                        })
                      }
                      max={320}
                      multiline
                      required
                      help="One or two natural sentences about Rustic Halo. Search engines may choose a different snippet."
                    />
                    <div className="hp-search-preview">
                      <small>rustichalo.com</small>
                      <strong>{draft.seo.title}</strong>
                      <p>{draft.seo.description}</p>
                    </div>
                  </section>
                </fieldset>
              </form>
            </div>
            <aside className="hp-preview-panel">
              <div className="hp-preview-heading">
                <div>
                  <h2>Draft preview</h2>
                  <p>Editable homepage sections</p>
                </div>
                <div role="group" aria-label="Preview size">
                  <button
                    type="button"
                    aria-pressed={!phone}
                    onClick={() => setPhone(false)}
                  >
                    Desktop
                  </button>
                  <button
                    type="button"
                    aria-pressed={phone}
                    onClick={() => setPhone(true)}
                  >
                    Phone
                  </button>
                </div>
              </div>
              <Preview
                content={draft}
                origin={saved.storefront_url}
                phone={phone}
              />
              <p className="hp-footnote">
                {dirty
                  ? "Your unsaved edits appear here."
                  : "Showing the saved draft."}{" "}
                Publish when you are ready to update the storefront.
              </p>
            </aside>
          </div>
        )}
        {blocker.state === "blocked" && (
          <div className="hp-leave-backdrop">
            <section
              className="hp-leave-dialog"
              role="alertdialog"
              aria-modal="true"
              aria-label="Unsaved homepage changes"
            >
              <h2>Keep your homepage changes?</h2>
              <p>
                You have unsaved edits. Save a draft or discard them before
                leaving.
              </p>
              <button type="button" onClick={() => blocker.reset()}>
                Keep editing
              </button>
              <button type="button" onClick={() => blocker.proceed()}>
                Discard and leave
              </button>
            </section>
          </div>
        )}
      </div>
    </LinkPickerProvider>
  );
};
export const config = defineRouteConfig({ label: "Storefront", rank: 7 });
export default StorefrontPage;
