// সারির ভেতরের বাটনের রঙ। প্রতিটি কাজের আলাদা রঙ, যাতে এক নজরে বোঝা যায়:
// বিস্তারিত = আকাশী, সম্পাদনা = ইন্ডিগো, ইতিহাস = বেগুনি,
// সম্পন্ন / চালু / পরিশোধ = সবুজ, বাতিল / বন্ধ = লাল।
const base =
  'rounded-md border px-2.5 py-1 text-xs font-medium transition disabled:cursor-not-allowed disabled:opacity-40'

export const rowAction = {
  view: `${base} border-sky-200 bg-sky-50 text-sky-700 hover:bg-sky-100`,
  edit: `${base} border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-100`,
  history: `${base} border-violet-200 bg-violet-50 text-violet-700 hover:bg-violet-100`,
  success: `${base} border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100`,
  danger: `${base} border-red-200 bg-red-50 text-red-700 hover:bg-red-100`,
} as const
