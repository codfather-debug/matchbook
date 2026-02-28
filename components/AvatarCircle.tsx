interface Props {
  name: string;
  avatarUrl?: string | null;
  size: number;
  textClassName?: string;
}

export default function AvatarCircle({ name, avatarUrl, size, textClassName = "text-sm font-black text-lime-700" }: Props) {
  return (
    <div
      className="rounded-full overflow-hidden bg-lime-50 flex items-center justify-center flex-shrink-0"
      style={{ width: size, height: size }}
    >
      {avatarUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={avatarUrl} alt={name} className="w-full h-full object-cover" />
      ) : (
        <span className={textClassName}>{name[0]?.toUpperCase() ?? "?"}</span>
      )}
    </div>
  );
}
