"use client";

import Image from "next/image";
import { FileTextIcon, XIcon } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { type FileRejection, useDropzone } from "react-dropzone";

import {
  ACCEPTED_UPLOAD_TYPES,
  MAX_UPLOAD_BYTES,
} from "@/constants";
import { cn, formatBytes } from "@/lib/utils";

interface FileUploaderProps {
  files: File[] | undefined;
  onChange: (files: File[]) => void;
  disabled?: boolean;
}

/**
 * Drag-and-drop upload for the identification document.
 *
 * Rejections are surfaced rather than swallowed — react-dropzone silently
 * discards files that fail its `accept`/`maxSize` filters, so without reading
 * `fileRejections` a user dropping a 12 MB scan just sees nothing happen.
 *
 * The object URL is revoked on change and unmount; leaking one per drop is a
 * real memory leak on a form people retry.
 */
export function FileUploader({ files, onChange, disabled }: FileUploaderProps) {
  const [rejection, setRejection] = useState<string | null>(null);

  const file = files?.[0];
  const isImage = file?.type.startsWith("image/") ?? false;

  const previewUrl = useMemo(
    () => (file && isImage ? URL.createObjectURL(file) : null),
    [file, isImage],
  );

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const onDrop = useCallback(
    (accepted: File[], rejections: FileRejection[]) => {
      if (rejections.length > 0) {
        const first = rejections[0]!;
        const code = first.errors[0]?.code;
        setRejection(
          code === "file-too-large"
            ? `That file is ${formatBytes(first.file.size)}. The limit is ${formatBytes(MAX_UPLOAD_BYTES)}.`
            : code === "file-invalid-type"
              ? "Use a PNG, JPEG, WebP or PDF."
              : "That file could not be accepted.",
        );
        return;
      }

      setRejection(null);
      onChange(accepted);
    },
    // `onChange` is included deliberately: omitting it (as the reference
    // implementation does) captures a stale closure over the form's setter.
    [onChange],
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: ACCEPTED_UPLOAD_TYPES,
    maxSize: MAX_UPLOAD_BYTES,
    maxFiles: 1,
    multiple: false,
    disabled,
  });

  function clear(event: React.MouseEvent) {
    event.stopPropagation();
    setRejection(null);
    onChange([]);
  }

  return (
    <div className="space-y-2">
      <div
        {...getRootProps()}
        className={cn(
          "file-upload transition-colors",
          isDragActive && "border-green-500 bg-green-600/20",
          disabled && "cursor-not-allowed opacity-60",
        )}
      >
        <input {...getInputProps()} aria-label="Identification document" />

        {file ? (
          <div className="flex w-full items-center gap-3">
            {previewUrl ? (
              <Image
                src={previewUrl}
                width={96}
                height={96}
                alt="Selected document preview"
                className="size-16 shrink-0 rounded-md object-cover"
                unoptimized
              />
            ) : (
              <span className="flex size-16 shrink-0 items-center justify-center rounded-md bg-muted">
                <FileTextIcon
                  className="size-6 text-foreground/80"
                  aria-hidden="true"
                />
              </span>
            )}

            <div className="min-w-0 flex-1 text-left">
              <p className="text-14-medium truncate text-foreground">
                {file.name}
              </p>
              <p className="text-12-regular text-muted-foreground">
                {formatBytes(file.size)}
              </p>
            </div>

            <button
              type="button"
              onClick={clear}
              aria-label={`Remove ${file.name}`}
              className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <XIcon className="size-4" aria-hidden="true" />
            </button>
          </div>
        ) : (
          <>
            <Image
              src="/assets/icons/upload.svg"
              width={40}
              height={40}
              alt=""
              aria-hidden="true"
            />
            <div className="file-upload_label">
              <p className="text-14-regular">
                <span className="text-brand">Click to upload</span> or drag
                and drop
              </p>
              <p>PNG, JPEG, WebP or PDF (max {formatBytes(MAX_UPLOAD_BYTES)})</p>
            </div>
          </>
        )}
      </div>

      {rejection ? (
        <p role="alert" className="text-14-regular text-destructive">
          {rejection}
        </p>
      ) : null}
    </div>
  );
}
