import { ImageResponse } from 'next/og';

export const size = { width: 192, height: 192 };
export const contentType = 'image/png';

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(135deg, #001428 0%, #0a2a4a 50%, #001428 100%)',
          borderRadius: 42,
          border: '3px solid #38bdf8',
          color: '#ffffff',
          fontFamily: 'sans-serif',
        }}
      >
        <div
          style={{
            fontSize: 64,
            lineHeight: 1,
            marginBottom: 4,
          }}
        >
          ✂️
        </div>
        <div
          style={{
            fontSize: 20,
            fontWeight: 900,
            letterSpacing: 2,
            color: '#f8fafc',
          }}
        >
          SMART
        </div>
        <div
          style={{
            fontSize: 12,
            fontWeight: 800,
            letterSpacing: 3,
            color: '#38bdf8',
          }}
        >
          SALON LK
        </div>
      </div>
    ),
    { ...size }
  );
}

