import React, { useState } from 'react';
import { ImageOff, Loader2 } from 'lucide-react';

interface OptimizedImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  src: string;
  alt: string;
  className?: string;
  fallbackSrc?: string;
  fallbackNode?: React.ReactNode;
  priority?: boolean;
  aspectRatio?: string;
}

export function OptimizedImage({
  src,
  alt,
  className = '',
  fallbackSrc,
  fallbackNode,
  priority = false,
  aspectRatio,
  onError,
  onLoad,
  ...props
}: OptimizedImageProps) {
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);

  const handleError = (e: React.SyntheticEvent<HTMLImageElement, Event>) => {
    setHasError(true);
    setIsLoaded(true);
    if (onError) onError(e);
  };

  const handleLoad = (e: React.SyntheticEvent<HTMLImageElement, Event>) => {
    setIsLoaded(true);
    if (onLoad) onLoad(e);
  };

  if (hasError) {
    if (fallbackNode) {
      return <>{fallbackNode}</>;
    }
    if (fallbackSrc) {
      return (
        <img
          src={fallbackSrc}
          alt={alt}
          className={className}
          style={{ aspectRatio }}
          {...props}
        />
      );
    }
    return (
      <div
        className={`flex items-center justify-center bg-muted/60 text-muted-foreground/50 rounded-lg ${className}`}
        style={{ aspectRatio }}
      >
        <ImageOff className="w-5 h-5" />
      </div>
    );
  }

  return (
    <div className={`relative overflow-hidden ${className}`} style={{ aspectRatio }}>
      {!isLoaded && (
        <div className="absolute inset-0 bg-muted/40 animate-pulse flex items-center justify-center">
          <Loader2 className="w-4 h-4 animate-spin text-muted-foreground/30" />
        </div>
      )}
      <img
        src={src}
        alt={alt}
        loading={priority ? 'eager' : 'lazy'}
        decoding="async"
        fetchPriority={priority ? 'high' : 'auto'}
        onLoad={handleLoad}
        onError={handleError}
        className={`w-full h-full object-cover transition-opacity duration-300 ${
          isLoaded ? 'opacity-100' : 'opacity-0'
        }`}
        {...props}
      />
    </div>
  );
}

export default OptimizedImage;
