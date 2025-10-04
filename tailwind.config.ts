import type { Config } from "tailwindcss";

export default {
	darkMode: ["class"],
	content: [
		"./pages/**/*.{ts,tsx}",
		"./components/**/*.{ts,tsx}",
		"./app/**/*.{ts,tsx}",
		"./src/**/*.{ts,tsx}",
	],
	prefix: "",
	theme: {
		container: {
			center: true,
			padding: '2rem',
			screens: {
				'2xl': '1400px'
			}
		},
		extend: {
			fontFamily: {
				sans: ['Poppins', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
			},
			screens: {
				'standalone': { 'raw': '(display-mode: standalone)' },
			},
			colors: {
				border: 'hsl(var(--border))',
				input: 'hsl(var(--input))',
				ring: 'hsl(var(--ring))',
				background: 'hsl(var(--background))',
				foreground: 'hsl(var(--foreground))',
				primary: {
					DEFAULT: 'hsl(var(--primary))',
					foreground: 'hsl(var(--primary-foreground))',
					glow: 'hsl(var(--primary-glow))'
				},
				secondary: {
					DEFAULT: 'hsl(var(--secondary))',
					foreground: 'hsl(var(--secondary-foreground))'
				},
				destructive: {
					DEFAULT: 'hsl(var(--destructive))',
					foreground: 'hsl(var(--destructive-foreground))'
				},
				muted: {
					DEFAULT: 'hsl(var(--muted))',
					foreground: 'hsl(var(--muted-foreground))'
				},
				accent: {
					DEFAULT: 'hsl(var(--accent))',
					foreground: 'hsl(var(--accent-foreground))'
				},
				popover: {
					DEFAULT: 'hsl(var(--popover))',
					foreground: 'hsl(var(--popover-foreground))'
				},
				card: {
					DEFAULT: 'hsl(var(--card))',
					foreground: 'hsl(var(--card-foreground))'
				},
				sidebar: {
					DEFAULT: 'hsl(var(--sidebar-background))',
					foreground: 'hsl(var(--sidebar-foreground))',
					primary: 'hsl(var(--sidebar-primary))',
					'primary-foreground': 'hsl(var(--sidebar-primary-foreground))',
					accent: 'hsl(var(--sidebar-accent))',
					'accent-foreground': 'hsl(var(--sidebar-accent-foreground))',
					border: 'hsl(var(--sidebar-border))',
					ring: 'hsl(var(--sidebar-ring))'
				},
				success: {
					DEFAULT: 'hsl(var(--success))',
					foreground: 'hsl(var(--success-foreground))'
				},
				warning: {
					DEFAULT: 'hsl(var(--warning))',
					foreground: 'hsl(var(--warning-foreground))'
				},
				info: {
					DEFAULT: 'hsl(var(--info))',
					foreground: 'hsl(var(--info-foreground))'
				},
				critical: {
					DEFAULT: 'hsl(var(--critical))',
					foreground: 'hsl(var(--critical-foreground))'
				}
			},
			backgroundImage: {
				'gradient-primary': 'var(--gradient-primary)',
				'gradient-subtle': 'var(--gradient-subtle)',
				'gradient-card': 'var(--gradient-card)',
				'gradient-hero': 'var(--gradient-hero)',
				'gradient-sidebar': 'var(--gradient-sidebar)'
			},
			boxShadow: {
				'elegant': 'var(--shadow-elegant)',
				'glow': 'var(--shadow-glow)',
				'card': 'var(--shadow-card)',
				'lg': 'var(--shadow-lg)',
				'neumorphic': 'var(--shadow-neumorphic)'
			},
			transitionTimingFunction: {
				'smooth': 'var(--transition-smooth)',
				'spring': 'var(--transition-spring)'
			},
			borderRadius: {
				lg: 'var(--radius)',
				md: 'calc(var(--radius) - 2px)',
				sm: 'calc(var(--radius) - 4px)'
			},
			keyframes: {
				'accordion-down': {
					from: { height: '0', opacity: '0' },
					to: { height: 'var(--radix-accordion-content-height)', opacity: '1' }
				},
				'accordion-up': {
					from: { height: 'var(--radix-accordion-content-height)', opacity: '1' },
					to: { height: '0', opacity: '0' }
				},
				'modal-enter': {
					'0%': { opacity: '0', transform: 'scale(0.96) translateY(-2px)' },
					'100%': { opacity: '1', transform: 'scale(1) translateY(0)' }
				},
				'modal-exit': {
					'0%': { opacity: '1', transform: 'scale(1) translateY(0)' },
					'100%': { opacity: '0', transform: 'scale(0.96) translateY(-2px)' }
				},
				'overlay-enter': {
					'0%': { opacity: '0' },
					'100%': { opacity: '1' }
				},
				'overlay-exit': {
					'0%': { opacity: '1' },
					'100%': { opacity: '0' }
				},
				'drawer-enter': {
					'0%': { transform: 'translateY(100%)' },
					'100%': { transform: 'translateY(0)' }
				},
				'drawer-exit': {
					'0%': { transform: 'translateY(0)' },
					'100%': { transform: 'translateY(100%)' }
				},
				'popover-enter': {
					'0%': { opacity: '0', transform: 'scale(0.95) translateY(-4px)' },
					'100%': { opacity: '1', transform: 'scale(1) translateY(0)' }
				},
				'popover-exit': {
					'0%': { opacity: '1', transform: 'scale(1) translateY(0)' },
					'100%': { opacity: '0', transform: 'scale(0.95) translateY(-4px)' }
				},
				'button-press': {
					'0%': { transform: 'scale(1)' },
					'50%': { transform: 'scale(0.98)' },
					'100%': { transform: 'scale(1)' }
				},
				'page-enter': {
					'0%': { opacity: '0', transform: 'translateY(8px)' },
					'100%': { opacity: '1', transform: 'translateY(0)' }
				},
				'slide-up': {
					'0%': { transform: 'translateY(100%)', opacity: '0' },
					'100%': { transform: 'translateY(0)', opacity: '1' }
				}
			},
			animation: {
				'accordion-down': 'accordion-down 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
				'accordion-up': 'accordion-up 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
				'modal-enter': 'modal-enter 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
				'modal-exit': 'modal-exit 0.2s cubic-bezier(0.4, 0, 1, 1)',
				'overlay-enter': 'overlay-enter 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
				'overlay-exit': 'overlay-exit 0.2s cubic-bezier(0.4, 0, 1, 1)',
				'drawer-enter': 'drawer-enter 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
				'drawer-exit': 'drawer-exit 0.25s cubic-bezier(0.4, 0, 1, 1)',
				'popover-enter': 'popover-enter 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
				'popover-exit': 'popover-exit 0.15s cubic-bezier(0.4, 0, 1, 1)',
				'button-press': 'button-press 0.1s cubic-bezier(0.4, 0, 0.2, 1)',
				'page-enter': 'page-enter 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
				'slide-up': 'slide-up 0.4s cubic-bezier(0.16, 1, 0.3, 1)'
			}
		}
	},
	plugins: [require("tailwindcss-animate")],
} satisfies Config;
