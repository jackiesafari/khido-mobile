import React, { useCallback, useMemo, useState } from 'react';
import { LayoutChangeEvent, Pressable, StyleSheet, Text, View } from 'react-native';
import {
  Canvas,
  Circle,
  Group,
  LinearGradient,
  Path,
  Rect,
  RoundedRect,
  Shadow,
  Skia,
  vec,
} from '@shopify/react-native-skia';

type Direction = 'N' | 'E' | 'S' | 'W';

export type TileData = {
  col: number;
  row: number;
  isActive: boolean;
  hasFlower: boolean;
  hasObstacle?: boolean;
  hasSwitch?: boolean;
  label?: 'Spring' | 'Gate' | 'Gate ✓' | 'Switch';
  openDirections: Direction[];
};

export type BridgeDotData = {
  id: string;
  aCol: number;
  aRow: number;
  bCol: number;
  bRow: number;
  active: boolean;
};

export type IsoBoardTheme = {
  skyColors: [string, string, string];
  stoneColors: [string, string, string];
  tileActive: [string, string, string];
  tileInactive: [string, string, string];
  pipeActive: string;
  pipeGlow: string;
  groundColor: string;
  starOpacity: number;
  /** Inactive pipe opacity (0–1). Level 2 uses higher value for visibility. */
  inactivePipeOpacity?: number;
  /** Extra stroke width for inactive pipes. Level 2 uses higher value. */
  inactivePipeStrokeBonus?: number;
};

type IsoBoardProps = {
  tiles: TileData[];
  bridgeDots?: BridgeDotData[];
  theme?: IsoBoardTheme;
  onTilePress?: (col: number, row: number) => void;
  debugTouches?: boolean;
  /** When true, labels (Spring, Gate) are placed inside tiles at the bottom, like Level 1 flat grid */
  labelsInsideTiles?: boolean;
};

type FlatTileData = {
  tile: TileData;
  x: number;
  y: number;
  size: number;
  pipePath: ReturnType<typeof Skia.Path.Make>;
};

type BridgeRenderData = {
  id: string;
  active: boolean;
  aCenter: { x: number; y: number };
  bCenter: { x: number; y: number };
  path: ReturnType<typeof Skia.Path.Make>;
};

const TILE_SIZE = 56;
const PIPE_STROKE = 10;
const STONE_DEPTH = 16;
const PADDING = 24;

// Top offset of the canvas inside the wrapper. Touch coordinates from Pressable are
// relative to the wrapper View, so we subtract this when mapping touch → tile.
const CANVAS_TOP_OFFSET = 20;
const ACTIVE_BRIDGE_COLOR = '#59BFE1';
const INACTIVE_BRIDGE_COLOR = '#59BFE133';
const BRIDGE_GLOW_COLOR = '#7dd7ff';

const DEFAULT_THEME: IsoBoardTheme = {
  skyColors: ['#7fb5b5', '#5a9a9a', '#4a8a8a'],
  stoneColors: ['#6a7c62', '#5a6b52', '#4a5a42'],
  tileActive: ['#8ab89a', '#6a9a7a', '#5a8a6a'],
  tileInactive: ['#7a8c6e', '#6a7c5e', '#5a6c4e'],
  pipeActive: '#4a9e6e',
  pipeGlow: '#00d2c8',
  groundColor: '#C9E8CE',
  starOpacity: 0.28,
};

function tileKey(col: number, row: number): string {
  return `${col},${row}`;
}

function cubicPoint(
  p0: { x: number; y: number },
  p1: { x: number; y: number },
  p2: { x: number; y: number },
  p3: { x: number; y: number },
  t: number
) {
  const mt = 1 - t;
  const mt2 = mt * mt;
  const t2 = t * t;
  const a = mt2 * mt;
  const b = 3 * mt2 * t;
  const c = 3 * mt * t2;
  const d = t * t2;
  return {
    x: a * p0.x + b * p1.x + c * p2.x + d * p3.x,
    y: a * p0.y + b * p1.y + c * p2.y + d * p3.y,
  };
}

function makeBridgeArcPath(
  aCenter: { x: number; y: number },
  bCenter: { x: number; y: number },
  dashed: boolean
): ReturnType<typeof Skia.Path.Make> {
  const controlY = Math.min(aCenter.y, bCenter.y) - 40;
  const deltaX = bCenter.x - aCenter.x;
  const cp1 = { x: aCenter.x + deltaX / 3, y: controlY };
  const cp2 = { x: aCenter.x + (2 * deltaX) / 3, y: controlY };

  if (!dashed) {
    const path = Skia.Path.Make();
    path.moveTo(aCenter.x, aCenter.y);
    path.cubicTo(cp1.x, cp1.y, cp2.x, cp2.y, bCenter.x, bCenter.y);
    return path;
  }

  const steps = 36;
  const path = Skia.Path.Make();
  let drawing = true;

  for (let i = 0; i < steps; i += 1) {
    const t0 = i / steps;
    const t1 = (i + 1) / steps;
    const p0 = cubicPoint(aCenter, cp1, cp2, bCenter, t0);
    const p1 = cubicPoint(aCenter, cp1, cp2, bCenter, t1);

    if (drawing) {
      path.moveTo(p0.x, p0.y);
      path.lineTo(p1.x, p1.y);
    }
    drawing = !drawing;
  }

  return path;
}

/** Pipe path for flat tile: edge center to edge center. Classic pipe puzzle style. */
function makeFlatPipePath(x: number, y: number, size: number, dirs: Direction[]): ReturnType<typeof Skia.Path.Make> {
  if (dirs.length !== 2) return Skia.Path.Make();
  const [a, b] = dirs;
  const h = size / 2;
  const cx = x + h;
  const cy = y + h;

  const edgeCenter = (d: Direction) => {
    if (d === 'N') return { x: cx, y };
    if (d === 'S') return { x: cx, y: y + size };
    if (d === 'E') return { x: x + size, y: cy };
    return { x, y: cy };
  };

  const p1 = edgeCenter(a);
  const p2 = edgeCenter(b);
  const p = Skia.Path.Make();
  p.moveTo(p1.x, p1.y);

  const isStraight = (a === 'N' && b === 'S') || (a === 'S' && b === 'N') || (a === 'E' && b === 'W') || (a === 'W' && b === 'E');
  if (isStraight) {
    p.lineTo(p2.x, p2.y);
  } else {
    p.lineTo(cx, cy);
    p.lineTo(p2.x, p2.y);
  }
  return p;
}

export function IsoBoard({ tiles, bridgeDots = [], theme = DEFAULT_THEME, onTilePress, debugTouches = __DEV__, labelsInsideTiles = false }: IsoBoardProps) {
  const [boardWidth, setBoardWidth] = useState(320);

  const computed = useMemo(() => {
    const maxCol = tiles.reduce((max, t) => Math.max(max, t.col), 0);
    const maxRow = tiles.reduce((max, t) => Math.max(max, t.row), 0);
    const cols = maxCol + 1;
    const rows = maxRow + 1;

    const gridW = cols * TILE_SIZE;
    const gridH = rows * TILE_SIZE;
    const stoneInnerW = gridW + PADDING * 2;
    const stoneInnerH = gridH + PADDING * 2;
    const stoneOuterW = stoneInnerW + STONE_DEPTH * 2;
    const stoneOuterH = stoneInnerH + STONE_DEPTH * 2;

    const stoneOriginX = (boardWidth - stoneOuterW) / 2;
    // gridOriginX/Y are pixel positions of tile [0,0] inside the Canvas (y=0 at canvas top).
    const gridOriginX = stoneOriginX + STONE_DEPTH + PADDING;
    const gridOriginY = STONE_DEPTH + PADDING;

    const flatTiles: FlatTileData[] = tiles.map((tile) => {
      const tx = gridOriginX + tile.col * TILE_SIZE;
      const ty = gridOriginY + tile.row * TILE_SIZE;
      const pipePath = makeFlatPipePath(tx, ty, TILE_SIZE, tile.openDirections);
      return { tile, x: tx, y: ty, size: TILE_SIZE, pipePath };
    });

    // Labels use touchOverlay coordinate space (absoluteFillObject from wrapper top).
    // When labelsInsideTiles: place at bottom of tile (like Level 1 flat grid). Otherwise: above tile.
    const LABEL_HEIGHT = 18;
    const labelWidth = labelsInsideTiles ? 52 : 60;
    const labelHalfWidth = labelWidth / 2;
    const labels = flatTiles
      .filter((e) => e.tile.label)
      .map((e) => ({
        key: `label-${e.tile.col}-${e.tile.row}`,
        text: e.tile.label as string,
        left: e.x + e.size / 2 - labelHalfWidth,
        top: labelsInsideTiles
          ? CANVAS_TOP_OFFSET + e.y + e.size - LABEL_HEIGHT - 4
          : CANVAS_TOP_OFFSET + e.y - 14,
        compact: labelsInsideTiles,
      }));

    const tileCenters = new Map<string, { x: number; y: number }>();
    for (const entry of flatTiles) {
      tileCenters.set(tileKey(entry.tile.col, entry.tile.row), {
        x: entry.x + entry.size / 2,
        y: entry.y + entry.size / 2,
      });
    }

    const bridges: BridgeRenderData[] = bridgeDots
      .map((bridge) => {
        const aCenter = tileCenters.get(tileKey(bridge.aCol, bridge.aRow));
        const bCenter = tileCenters.get(tileKey(bridge.bCol, bridge.bRow));
        if (!aCenter || !bCenter) return null;
        return {
          id: bridge.id,
          active: bridge.active,
          aCenter,
          bCenter,
          path: makeBridgeArcPath(aCenter, bCenter, !bridge.active),
        };
      })
      .filter((bridge): bridge is BridgeRenderData => bridge !== null);

    const canvasHeight = stoneOuterH + PADDING;

    return {
      flatTiles,
      gridOriginX,
      gridOriginY,
      stoneOriginX,
      stoneOuterW,
      stoneOuterH,
      stoneInnerW,
      stoneInnerH,
      labels,
      bridges,
      canvasHeight,
    };
  }, [tiles, bridgeDots, boardWidth, labelsInsideTiles]);

  const onLayout = (event: LayoutChangeEvent) => {
    const nextWidth = Math.max(event.nativeEvent.layout.width, 240);
    if (Math.abs(nextWidth - boardWidth) > 1) setBoardWidth(nextWidth);
  };

  const handlePressIn = useCallback(
    (evt: { nativeEvent: { locationX: number; locationY: number } }) => {
      const { locationX: px, locationY: rawPY } = evt.nativeEvent;

      // Touch is relative to wrapper. Canvas tile y is relative to canvas top.
      // Subtract CANVAS_TOP_OFFSET to convert wrapper-space Y → canvas-space Y.
      const py = rawPY - CANVAS_TOP_OFFSET;

      if (debugTouches) {
        const col = Math.floor((px - computed.gridOriginX) / TILE_SIZE);
        const row = Math.floor((py - computed.gridOriginY) / TILE_SIZE);
        console.log('[IsoBoard debug]', { touchX: px, touchY: py, col, row });
      }

      for (const entry of computed.flatTiles) {
        if (
          px >= entry.x &&
          px < entry.x + entry.size &&
          py >= entry.y &&
          py < entry.y + entry.size
        ) {
          onTilePress?.(entry.tile.col, entry.tile.row);
          return;
        }
      }
    },
    [computed.flatTiles, computed.gridOriginX, computed.gridOriginY, onTilePress, debugTouches]
  );

  const stars = useMemo(
    () =>
      Array.from({ length: 24 }, (_, i) => ({
        x: (i * 37) % Math.max(boardWidth - 4, 1),
        y: (i * 53) % Math.max(computed.canvasHeight - 4, 1),
        opacity: i % 3 === 0 ? 0.55 : 0.28,
      })),
    [boardWidth, computed.canvasHeight]
  );

  const totalHeight = CANVAS_TOP_OFFSET + computed.canvasHeight;

  return (
    <View
      style={[
        styles.wrapper,
        { borderColor: theme.skyColors[2], backgroundColor: theme.skyColors[1] },
      ]}
      onLayout={onLayout}
    >
      <Canvas
        style={{
          width: boardWidth,
          height: computed.canvasHeight,
          marginTop: CANVAS_TOP_OFFSET,
        }}
      >
        <Rect x={0} y={0} width={boardWidth} height={computed.canvasHeight}>
          <LinearGradient start={vec(0, 0)} end={vec(boardWidth, computed.canvasHeight)} colors={theme.skyColors} />
        </Rect>

        {stars.map((star, i) => (
          <Circle key={`star-${i}`} cx={star.x} cy={star.y} r={1.2} color={`rgba(255,255,255,${star.opacity * theme.starOpacity})`} />
        ))}

        {/* Stone base - 3D block frame for atmosphere */}
        <Group>
          {/* Left face - gives 3D depth */}
          <Path
            path={(() => {
              const p = Skia.Path.Make();
              p.moveTo(computed.stoneOriginX, computed.stoneOuterH);
              p.lineTo(computed.stoneOriginX + STONE_DEPTH, STONE_DEPTH + computed.stoneInnerH);
              p.lineTo(computed.stoneOriginX + STONE_DEPTH, STONE_DEPTH);
              p.lineTo(computed.stoneOriginX, 0);
              p.close();
              return p;
            })()}
          >
            <LinearGradient
              start={vec(computed.stoneOriginX, 0)}
              end={vec(computed.stoneOriginX + STONE_DEPTH, computed.stoneOuterH)}
              colors={[theme.stoneColors[1], theme.stoneColors[2], theme.stoneColors[2]]}
            />
          </Path>
          {/* Right face */}
          <Path
            path={(() => {
              const p = Skia.Path.Make();
              const rx = computed.stoneOriginX + computed.stoneOuterW;
              p.moveTo(rx, 0);
              p.lineTo(rx - STONE_DEPTH, STONE_DEPTH);
              p.lineTo(rx - STONE_DEPTH, STONE_DEPTH + computed.stoneInnerH);
              p.lineTo(rx, computed.stoneOuterH);
              p.close();
              return p;
            })()}
          >
            <LinearGradient
              start={vec(computed.stoneOriginX + computed.stoneOuterW - STONE_DEPTH, 0)}
              end={vec(computed.stoneOriginX + computed.stoneOuterW, computed.stoneOuterH)}
              colors={[theme.stoneColors[0], theme.stoneColors[1], theme.stoneColors[2]]}
            />
          </Path>
          {/* Top face */}
          <RoundedRect
            x={computed.stoneOriginX}
            y={0}
            width={computed.stoneOuterW}
            height={computed.stoneOuterH}
            r={10}
          >
            <LinearGradient
              start={vec(computed.stoneOriginX, 0)}
              end={vec(computed.stoneOriginX + computed.stoneOuterW, computed.stoneOuterH)}
              colors={theme.stoneColors}
            />
          </RoundedRect>
          {/* Inner recess - where tiles sit */}
          <RoundedRect
            x={computed.stoneOriginX + STONE_DEPTH}
            y={STONE_DEPTH}
            width={computed.stoneInnerW}
            height={computed.stoneInnerH}
            r={6}
          >
            <LinearGradient
              start={vec(computed.stoneOriginX + STONE_DEPTH, STONE_DEPTH)}
              end={vec(
                computed.stoneOriginX + STONE_DEPTH + computed.stoneInnerW,
                STONE_DEPTH + computed.stoneInnerH
              )}
              colors={[theme.stoneColors[0], theme.stoneColors[0], theme.stoneColors[1]]}
            />
          </RoundedRect>
        </Group>

        {/* Flat tiles - top-down squares with pipes */}
        {computed.flatTiles.map((entry) => (
          <Group key={`tile-${entry.tile.col}-${entry.tile.row}`}>
            <RoundedRect x={entry.x} y={entry.y} width={entry.size} height={entry.size} r={6}>
              <LinearGradient
                start={vec(entry.x, entry.y)}
                end={vec(entry.x + entry.size, entry.y + entry.size)}
                colors={entry.tile.isActive ? theme.tileActive : theme.tileInactive}
              />
              {entry.tile.isActive && <Shadow dx={0} dy={0} blur={8} color={theme.pipeGlow} />}
            </RoundedRect>

            <Path
              path={entry.pipePath}
              color={theme.pipeActive}
              opacity={entry.tile.isActive ? 1 : (theme.inactivePipeOpacity ?? 0.78)}
              style="stroke"
              strokeWidth={
                entry.tile.isActive
                  ? PIPE_STROKE
                  : PIPE_STROKE + (theme.inactivePipeStrokeBonus ?? 2)
              }
              strokeCap="round"
              strokeJoin="round"
            >
              {entry.tile.isActive && <Shadow dx={0} dy={0} blur={4} color={theme.pipeGlow} />}
            </Path>

            {entry.tile.hasFlower && !entry.tile.isActive && (
              <Circle cx={entry.x + entry.size * 0.3} cy={entry.y + entry.size * 0.6} r={3} color="#e8a0c0" opacity={0.9} />
            )}
            {entry.tile.hasObstacle && (
              <Circle cx={entry.x + entry.size * 0.77} cy={entry.y + entry.size * 0.25} r={4.5} color="#5d6f80" opacity={0.95} />
            )}
          </Group>
        ))}

        {computed.bridges.map((bridge) => (
          <Group key={bridge.id}>
            <Rect
              x={bridge.aCenter.x - 4}
              y={bridge.aCenter.y + 4}
              width={8}
              height={10}
              color={theme.stoneColors[1]}
            />
            <Rect
              x={bridge.bCenter.x - 4}
              y={bridge.bCenter.y + 4}
              width={8}
              height={10}
              color={theme.stoneColors[1]}
            />
            <Path
              path={bridge.path}
              color={bridge.active ? ACTIVE_BRIDGE_COLOR : INACTIVE_BRIDGE_COLOR}
              style="stroke"
              strokeWidth={bridge.active ? 6 : 4}
              strokeCap="round"
              strokeJoin="round"
            >
              {bridge.active && <Shadow dx={0} dy={0} blur={8} color={BRIDGE_GLOW_COLOR} />}
            </Path>
          </Group>
        ))}
      </Canvas>

      <Pressable
        style={[styles.touchHitArea, { width: boardWidth, height: totalHeight }]}
        onPressIn={handlePressIn}
      />

      <View
        style={[styles.touchOverlay, { height: totalHeight, zIndex: 1001 }]}
        pointerEvents="box-none"
      >
        {computed.labels.map((label) => (
          <View
            key={label.key}
            style={[
              styles.tileLabelWrap,
              { left: label.left, top: label.top, width: label.compact ? 52 : 60 },
            ]}
            pointerEvents="none">
            <View
              style={[
                styles.tileLabel,
                label.text === 'Gate' && styles.tileLabelGate,
                label.text === 'Gate ✓' && styles.tileLabelGateConnected,
                label.text === 'Switch' && styles.tileLabelSwitch,
                label.compact && styles.tileLabelCompact,
              ]}>
              <Text style={[styles.tileLabelText, label.compact && styles.tileLabelTextCompact]}>
                {label.text}
              </Text>
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    width: '100%',
    minHeight: 360,
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#4a8a8a',
    backgroundColor: '#5a9a9a',
    // Canvas uses marginTop (CANVAS_TOP_OFFSET) so touch and canvas coordinates align
  },
  touchOverlay: {
    ...StyleSheet.absoluteFillObject,
  },
  touchHitArea: {
    position: 'absolute',
    top: 0,
    left: 0,
    zIndex: 1000,
  },
  tileLabelWrap: {
    position: 'absolute',
    alignItems: 'center',
    zIndex: 600,
  },
  tileLabel: {
    backgroundColor: '#1e6e4a',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 10,
  },
  tileLabelCompact: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  tileLabelGate: {
    backgroundColor: '#1a4a7a',
  },
  tileLabelGateConnected: {
    backgroundColor: '#1A6B4A',
    borderWidth: 2,
    borderColor: '#00d2c8',
  },
  tileLabelSwitch: {
    backgroundColor: '#B8860B',
    borderWidth: 2,
    borderColor: '#DAA520',
  },
  tileLabelText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  tileLabelTextCompact: {
    fontSize: 9,
  },
});
