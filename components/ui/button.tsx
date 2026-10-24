import { Button as ButtonPrimitive } from '@base-ui/react/button'
import { cva, type VariantProps } from 'class-variance-authority'

import { cn } from '@/lib/utils'

// সব বাটনের রঙের নিয়ম এক জায়গায়:
// সেভ, জমা, লগইন = নীল (default)। সফল কাজ = সবুজ (success)।
// বন্ধ, বাতিল, মুছে ফেলা = লাল (destructive)। বাতিল বা পেছনে যাওয়া = সাদা রূপরেখা (outline)।
const buttonVariants = cva(
  'inline-flex shrink-0 cursor-pointer items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-semibold transition-colors outline-none select-none focus-visible:ring-4 focus-visible:ring-blue-500/30 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*="size-"])]:size-4',
  {
    variants: {
      variant: {
        default: 'bg-blue-600 text-white shadow-sm shadow-blue-600/25 hover:bg-blue-700 active:bg-blue-800',
        success: 'bg-emerald-600 text-white shadow-sm shadow-emerald-600/25 hover:bg-emerald-700 active:bg-emerald-800',
        destructive: 'bg-red-600 text-white shadow-sm shadow-red-600/25 hover:bg-red-700 active:bg-red-800',
        outline: 'border border-gray-300 bg-white text-gray-700 shadow-sm hover:bg-gray-50',
        secondary: 'bg-gray-100 text-gray-800 hover:bg-gray-200',
        ghost: 'text-gray-700 hover:bg-gray-100',
        link: 'text-blue-600 underline-offset-4 hover:underline',
      },
      size: {
        default: 'h-10 px-5',
        xs: 'h-6 px-2 text-xs',
        sm: 'h-8 px-3 text-xs',
        lg: 'h-11 px-6 text-base',
        icon: 'size-9',
        'icon-xs': 'size-6',
        'icon-sm': 'size-8',
        'icon-lg': 'size-11',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
)

function Button({
  className,
  variant = 'default',
  size = 'default',
  ...props
}: ButtonPrimitive.Props & VariantProps<typeof buttonVariants>) {
  return (
    <ButtonPrimitive
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
