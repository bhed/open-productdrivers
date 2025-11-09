/**
 * ProductDrivers Logo Component
 */

import Image from 'next/image';

interface LogoProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

const sizeMap = {
  sm: { width: 80, height: 30 },
  md: { width: 160, height: 60 },
  lg: { width: 240, height: 90 },
};

export function Logo({ className = '', size = 'md' }: LogoProps) {
  const dimensions = sizeMap[size];
  
  return (
    <Image
      src="/logo.svg"
      alt="ProductDrivers"
      width={dimensions.width}
      height={dimensions.height}
      className={className}
      priority
    />
  );
}

export function LogoIcon({ className = '', size = 32 }: { className?: string; size?: number }) {
  return (
    <div className={`rounded bg-primary flex items-center justify-center ${className}`} style={{ width: size, height: size }}>
      <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" width={size * 0.6} height={size * 0.6}>
        <path 
          d="M12 3L4 9v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V9l-8-6z" 
          fill="currentColor" 
          className="text-primary-foreground"
          opacity="0.9"
        />
        <path 
          d="M12 7c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 8c-2.67 0-8 1.34-8 4v1h16v-1c0-2.66-5.33-4-8-4z" 
          fill="currentColor" 
          className="text-primary-foreground"
        />
      </svg>
    </div>
  );
}

