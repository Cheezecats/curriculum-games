export function FlightArt() {
  return (
    <svg viewBox="0 0 650 260" aria-hidden="true" preserveAspectRatio="xMidYMid slice">
      <defs>
        <pattern
          id="flight-grid"
          width="28"
          height="28"
          patternUnits="userSpaceOnUse"
          patternTransform="skewX(-25)"
        >
          <path d="M28 0H0V28" fill="none" stroke="#a8c8b7" strokeWidth=".5" opacity=".35" />
        </pattern>
        <linearGradient id="flight-bg" x2="1" y2="1">
          <stop stopColor="#dcece2" />
          <stop offset="1" stopColor="#bfd9c9" />
        </linearGradient>
      </defs>
      <rect width="650" height="260" fill="url(#flight-bg)" />
      <rect width="650" height="260" fill="url(#flight-grid)" />
      <path d="M-10 262 80 176l90 37 54-84 89 34 50-41 86 65 100-52 110 58v70z" fill="#a7c5b3" />
      <path d="m15 260 85-56 64 16 58-56 86 26 56-36 84 55 103-36 109 47v42z" fill="#88af99" />
      <path d="m68 257 44-32 46 20 48-10 30 27zM448 261l58-48 64 29 34-15 55 29z" fill="#709d86" />
      <path
        d="M-20 190Q110 76 244 114T485 82 690 10"
        fill="none"
        stroke="#406f5a"
        strokeWidth="1.5"
        strokeDasharray="4 6"
        opacity=".7"
      />
      <ellipse cx="337" cy="216" rx="88" ry="11" fill="#3d6b5030" transform="rotate(-8 337 216)" />
      <g transform="translate(345 133) rotate(-16)">
        <path
          d="m-139 2 134-12 139 28-2 13L-5 13-138 16z"
          fill="#f2e7cb"
          stroke="#89917a"
          strokeWidth="1"
        />
        <path d="m-139 2 1 14L-5 13v-14z" fill="#c2bea5" />
        <path d="m-5-10 139 28-23 2L-10 1z" fill="#fff9df" />
        <path d="m-135 2 33-3 2 15-35 2zM101 12l33 6-2 13-33-6z" fill="#e08e5d" />
        <path
          d="m-16-74 17-12 20 12 2 149-20 20-22-20z"
          fill="#fff6d7"
          stroke="#9c9d84"
          strokeWidth="1"
        />
        <path d="m1-86 20 12 2 149-20 20 1-150z" fill="#c4bfa3" />
        <path d="m-16-74 17-12 20 12-16 9z" fill="#fffbe7" />
        <path d="m-11-64 10-5 13 5 1 28-12 5-11-6z" fill="#486b65" />
        <path d="m-11-64 10-5 2 35-13-3z" fill="#74918a" />
        <path d="m-56 62 58-9 58 17-1 12-57-15-58 6z" fill="#e7e1c8" stroke="#8b927c" />
        <path d="m-56 62 1 11 57-6V55z" fill="#b6b79a" />
        <path d="m2 43 17 14 1 26L2 71z" fill="#da8e61" stroke="#a87350" />
        <path d="m-14-77 14-11 17 11v6l-14 4-17-4z" fill="#edb083" />
        <path d="m-48-84 94 11" stroke="#35574c" strokeWidth="5" strokeLinecap="round" />
        <circle cx="1" cy="-78" r="5" fill="#304e44" />
      </g>
      <g fill="none" stroke="#4e7861" strokeWidth="1">
        <path d="M180 55h35v28" />
        <circle cx="215" cy="86" r="3" />
        <path d="m486 168 18-18h40" />
        <circle cx="482" cy="172" r="3" />
      </g>
      <g fontFamily="monospace" fontSize="8" fill="#3e6953" letterSpacing="1">
        <text x="127" y="54">
          YOUR DESIGN
        </text>
        <text x="511" y="145">
          YOUR NEXT TRY
        </text>
      </g>
      <g stroke="#6e967e" opacity=".7">
        <path d="M590 34v13m-6-6h12M54 143v10m-5-5h10" />
      </g>
    </svg>
  );
}

export function VisionArt() {
  return (
    <svg viewBox="0 0 650 260" aria-hidden="true" preserveAspectRatio="xMidYMid slice">
      <defs>
        <pattern id="vision-dots" width="20" height="20" patternUnits="userSpaceOnUse">
          <circle cx="2" cy="2" r=".8" fill="#859786" opacity=".3" />
        </pattern>
      </defs>
      <rect width="650" height="260" fill="#e5e9d8" />
      <rect width="650" height="260" fill="url(#vision-dots)" />
      <path d="m23 245 120-64h410l88 64z" fill="#c9d4bd" />
      <path d="m56 194 79-39h405l74 40v28H57z" fill="#526e62" />
      <path d="m56 194 79-39h405l74 40H57z" fill="#b5c2a8" />
      <path d="M77 197h516v18H77z" fill="#3f5c50" />
      {Array.from({ length: 19 }, (_, i) => (
        <g key={i}>
          <circle cx={88 + i * 27} cy="206" r="5.2" fill="#829985" />
          <path d={`m${91 + i * 25} 189 45-27`} stroke="#849d86" strokeWidth="1" />
        </g>
      ))}
      <path d="m131 166 27-17 26 17-27 17z" fill="#f1b48e" />
      <path d="m131 166 26 17v-24l-26-17z" fill="#d88e64" />
      <path d="m157 159 27-17v24l-27 17z" fill="#e8a77f" />
      <path d="m131 142 26-17 27 17-27 17z" fill="#f6cba8" />
      <ellipse cx="251" cy="164" rx="20" ry="11" fill="#476e63" />
      <path d="M231 164v-24h40v24" fill="#4d786d" />
      <ellipse cx="251" cy="140" rx="20" ry="11" fill="#81a395" />
      <path d="m472 175 25-45 26 45z" fill="#f0c77b" />
      <path d="m497 130 15-8 26 44-15 9z" fill="#d4ae61" />
      <path d="m472 175 15-8 51-1-15 9z" fill="#ba9e58" />
      <ellipse cx="379" cy="179" rx="42" ry="12" fill="#34524720" />
      <path d="m354 177 24-14 28 14v11l-26 14-26-14z" fill="#5a7060" />
      <path d="m354 177 24-14 28 14-26 14z" fill="#8ea18a" />
      <path d="m368 178 4-55 19-2 2 56z" fill="#e0d6b1" stroke="#a99e7e" />
      <path d="m380 123-37-45 13-14 43 51z" fill="#f6d5a0" stroke="#ad976b" />
      <path d="m350 74-40 34-10-13 43-40z" fill="#e8bc79" stroke="#ad976b" />
      <circle cx="350" cy="69" r="14" fill="#fff0ca" stroke="#ad976b" />
      <circle cx="350" cy="69" r="6" fill="#8b9c82" />
      <circle cx="382" cy="121" r="12" fill="#fff0ca" stroke="#ad976b" />
      <circle cx="382" cy="121" r="5" fill="#879b7f" />
      <g transform="translate(302 104) rotate(13)">
        <rect x="-21" y="-12" width="42" height="28" rx="9" fill="#456a60" />
        <rect x="-16" y="-7" width="32" height="17" rx="4" fill="#a9c7ae" />
        <circle cx="-6" cy="1" r="3" fill="#2b4d42" />
        <circle cx="7" cy="1" r="3" fill="#2b4d42" />
        <path d="m-20 14-7 15m47-15 7 15" stroke="#466557" strokeWidth="5" strokeLinecap="round" />
      </g>
      <rect x="452" y="58" width="74" height="47" rx="5" fill="#f9f8e9" stroke="#b6c1a5" />
      <g fill="#68866e">
        {[0, 1, 2].flatMap((y) =>
          [0, 1, 2].map((x) => (
            <rect
              key={`${x}-${y}`}
              x={465 + x * 11}
              y={68 + y * 10}
              width="7"
              height="7"
              rx="1"
              opacity={0.2 + (x + y) * 0.15}
            />
          )),
        )}
      </g>
      <path d="M506 72h11m-11 7h11m-11 7h6" stroke="#a0b197" strokeWidth="2" />
      <path
        d="M444 81h-23l-14 17M278 72h-35l-20 35"
        fill="none"
        stroke="#91a787"
        strokeWidth="1"
        strokeDasharray="3 4"
      />
      <g fontFamily="monospace" fontSize="8" fill="#597759" letterSpacing="1">
        <text x="215" y="61">
          LEARN FROM EXAMPLES
        </text>
        <text x="463" y="48">
          LOOK CLOSER
        </text>
      </g>
    </svg>
  );
}
