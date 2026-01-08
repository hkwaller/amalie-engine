/**
 * RoomQRCode - QR code component for easy player joining
 */

import React from "react";
import { generateJoinUrl } from "../core/room";

export interface RoomQRCodeProps {
  /**
   * The room code to encode
   */
  roomCode: string;

  /**
   * Base URL for the join link (e.g., "https://myquiz.com/play")
   */
  baseUrl: string;

  /**
   * QR code size in pixels
   * @default 256
   */
  size?: number;

  /**
   * Background color
   * @default "#ffffff"
   */
  bgColor?: string;

  /**
   * Foreground color
   * @default "#000000"
   */
  fgColor?: string;

  /**
   * Include margin around QR code
   * @default true
   */
  includeMargin?: boolean;

  /**
   * Error correction level
   * @default "M"
   */
  level?: "L" | "M" | "Q" | "H";

  /**
   * Additional CSS class name
   */
  className?: string;

  /**
   * Additional inline styles
   */
  style?: React.CSSProperties;
}

/**
 * QR Code component that displays a scannable code for players to join
 *
 * Requires `qrcode.react` as an optional peer dependency.
 * If not installed, renders a fallback with the join URL.
 *
 * @example
 * ```tsx
 * <RoomQRCode
 *   roomCode={roomCode}
 *   baseUrl="https://myquiz.com/play"
 *   size={256}
 * />
 * ```
 */
export function RoomQRCode({
  roomCode,
  baseUrl,
  size = 256,
  bgColor = "#ffffff",
  fgColor = "#000000",
  includeMargin = true,
  level = "M",
  className,
  style,
}: RoomQRCodeProps) {
  const joinUrl = generateJoinUrl(baseUrl, roomCode);

  // Try to import qrcode.react dynamically
  // This allows the component to work even if qrcode.react isn't installed
  let QRCodeComponent: React.ComponentType<{
    value: string;
    size: number;
    bgColor: string;
    fgColor: string;
    includeMargin: boolean;
    level: string;
  }> | null = null;

  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const qrcode = require("qrcode.react");
    QRCodeComponent = qrcode.QRCodeSVG || qrcode.default;
  } catch {
    // qrcode.react not installed
  }

  const containerStyle: React.CSSProperties = {
    display: "inline-flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "12px",
    ...style,
  };

  // Fallback when qrcode.react is not available
  if (!QRCodeComponent) {
    return (
      <div className={className} style={containerStyle}>
        <div
          style={{
            width: size,
            height: size,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: bgColor,
            border: `2px dashed ${fgColor}`,
            borderRadius: "8px",
            padding: "16px",
            boxSizing: "border-box",
          }}
        >
          <div style={{ textAlign: "center", color: fgColor }}>
            <p style={{ margin: 0, fontWeight: "bold", fontSize: "14px" }}>
              Join Code:
            </p>
            <p
              style={{
                margin: "8px 0",
                fontSize: "24px",
                fontFamily: "monospace",
                letterSpacing: "2px",
              }}
            >
              {roomCode}
            </p>
            <p style={{ margin: 0, fontSize: "12px", opacity: 0.7 }}>
              Install qrcode.react for QR code
            </p>
          </div>
        </div>
        <span
          style={{
            fontSize: "14px",
            color: fgColor,
            fontFamily: "monospace",
            wordBreak: "break-all",
            textAlign: "center",
            maxWidth: size,
          }}
        >
          {joinUrl}
        </span>
      </div>
    );
  }

  return (
    <div className={className} style={containerStyle}>
      <QRCodeComponent
        value={joinUrl}
        size={size}
        bgColor={bgColor}
        fgColor={fgColor}
        includeMargin={includeMargin}
        level={level}
      />
      <span
        style={{
          fontSize: "14px",
          color: fgColor,
          fontFamily: "monospace",
          wordBreak: "break-all",
          textAlign: "center",
          maxWidth: size,
        }}
      >
        {joinUrl}
      </span>
    </div>
  );
}

/**
 * Hook to get the join URL for a room
 */
export function useJoinUrl(baseUrl: string, roomCode: string): string {
  return generateJoinUrl(baseUrl, roomCode);
}
