'use client';

import { Toaster as HotToaster } from 'react-hot-toast';

export default function Toaster() {
  return (
    <HotToaster
      position="top-center"
      toastOptions={{
        duration: 2500,
        style: {
          borderRadius: '12px',
          padding: '12px 14px',
        },
      }}
    />
  );
}
