import { ImageResponse } from 'next/og';

export const size = { width: 180, height: 180 };
export const contentType = 'image/png';

export default function AppleIcon() {
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
          borderRadius: 36,
          border: '2px solid #38bdf8',
          color: '#ffffff',
          fontFamily: 'sans-serif',
        }}
      >
        <div style={{ fontSize: 60, marginBottom: 4 }}>✂️</div>
        <div style={{ fontSize: 18, fontWeight: 900, letterSpacing: 2, color: '#f8fafc' }}>
          SMART SALON
        </div>
        <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 3, color: '#38bdf8' }}>
          LK • ශ්‍රී ලංකා
        </div>
      </div>
    ),
    { ...size }
  );
}

