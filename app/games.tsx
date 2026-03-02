import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  SafeAreaView,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { IsoBoard, type BridgeDotData, type TileData } from '@/components/IsoBoard';
import { ThemedView } from '@/components/themed-view';
import { logGardenEvent } from '@/lib/garden-analytics';
import {
  GARDEN_SESSION_SEED,
  PUZZLE_LEVELS,
  cloneRotations,
  ensureUnsolvedBoard,
  findReachableNodes,
  getInitiallySolvedLevelIds,
  getTileOpenDirections,
  isPerspectiveLinkActive,
  isPuzzleSolved,
  tileKey,
  tileSizeForLevel,
} from '@/lib/garden-puzzle';
import { markFeatureUsed, recordGameCompletion } from '@/lib/profile-sync';
import { Routes } from '@/types/navigation';
import { styles } from '@/app/games.styles';

type GameType = 'breathing' | 'ripples' | 'puzzle';

type Ripple = {
  id: number;
  x: number;
  y: number;
  progress: Animated.Value;
};

const IDLE_WINDOW_MS = 12_000;

export default function GamesScreen() {
  const [selectedGame, setSelectedGame] = useState<GameType>('breathing');
  const [isBreathing, setIsBreathing] = useState(false);
  const [ripples, setRipples] = useState<Ripple[]>([]);

  const [activeLevelIndex, setActiveLevelIndex] = useState(0);
  const activeLevel = PUZZLE_LEVELS[activeLevelIndex];

  const [puzzleRotations, setPuzzleRotations] = useState<number[][]>(
    ensureUnsolvedBoard(activeLevel, cloneRotations(activeLevel.initialRotations))
  );
  const [moves, setMoves] = useState(0);
  const [showHint, setShowHint] = useState(false);

  const orbScale = useRef(new Animated.Value(1)).current;
  const ambienceDrift = useRef(new Animated.Value(0)).current;
  const breathLoopRef = useRef<Animated.CompositeAnimation | null>(null);
  const lastTileTapRef = useRef<{ row: number; col: number; time: number } | null>(null);
  const levelStartedAtRef = useRef(Date.now());
  const lastInteractionAtRef = useRef(Date.now());
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const completedLevelsRef = useRef<Set<number>>(new Set());
  const rewardScreenShownRef = useRef(false);

  const flowerTileKeySet = useMemo(() => new Set(activeLevel.flowerTileKeys), [activeLevel.flowerTileKeys]);
  const obstacleTileKeySet = useMemo(() => new Set(activeLevel.obstacleTileKeys), [activeLevel.obstacleTileKeys]);

  const logAnalytics = useCallback((
    eventType: 'level_started' | 'tile_tap_pattern' | 'level_restart' | 'level_time_spent' | 'level_completed' | 'idle_period',
    payload?: Record<string, unknown>
  ) => {
    logGardenEvent({
      sessionSeed: GARDEN_SESSION_SEED,
      levelId: activeLevel.id,
      eventType,
      payload: {
        levelSeed: activeLevel.seed,
        ...payload,
      },
    });
  }, [activeLevel.id, activeLevel.seed]);

  const scheduleIdleWindow = useCallback(() => {
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    idleTimerRef.current = setTimeout(() => {
      const idleMs = Date.now() - lastInteractionAtRef.current;
      if (selectedGame === 'puzzle' && idleMs >= IDLE_WINDOW_MS) {
        logAnalytics('idle_period', { idleMs, moves });
        lastInteractionAtRef.current = Date.now();
      }
      scheduleIdleWindow();
    }, IDLE_WINDOW_MS);
  }, [logAnalytics, moves, selectedGame]);

  const markInteraction = useCallback((source: string, metadata?: Record<string, unknown>) => {
    const now = Date.now();
    const sinceLastTapMs = now - lastInteractionAtRef.current;
    lastInteractionAtRef.current = now;
    logAnalytics('tile_tap_pattern', {
      source,
      sinceLastTapMs,
      ...metadata,
    });
    scheduleIdleWindow();
  }, [logAnalytics, scheduleIdleWindow]);

  const recordLevelTimeSpent = useCallback((reason: 'switch' | 'restart' | 'complete' | 'leave_puzzle') => {
    const now = Date.now();
    logAnalytics('level_time_spent', {
      reason,
      durationMs: now - levelStartedAtRef.current,
      moves,
    });
  }, [logAnalytics, moves]);

  const puzzleSolved = useMemo(() => isPuzzleSolved(activeLevel, puzzleRotations), [activeLevel, puzzleRotations]);

  const reachableNodes = useMemo(
    () => findReachableNodes(activeLevel, puzzleRotations),
    [activeLevel, puzzleRotations]
  );

  const showComplete = puzzleSolved && reachableNodes.has(tileKey(activeLevel.goal.x, activeLevel.goal.y));
  const switchTileKeySet = useMemo(() => {
    const set = new Set<string>();
    for (const link of activeLevel.perspectiveLinks) {
      if (link.requiredSwitch) set.add(tileKey(link.requiredSwitch.tile.x, link.requiredSwitch.tile.y));
    }
    return set;
  }, [activeLevel.perspectiveLinks]);
  const isoTiles = useMemo<TileData[]>(() => {
    return activeLevel.layout.flatMap((row, rowIndex) =>
      row.map((kind, colIndex) => {
        const isStart = rowIndex === activeLevel.start.y && colIndex === activeLevel.start.x;
        const isGoal = rowIndex === activeLevel.goal.y && colIndex === activeLevel.goal.x;
        const isSwitch = switchTileKeySet.has(tileKey(colIndex, rowIndex));

        // Glow ONLY for tiles reachable from Spring (strict BFS from level.start)
        const isReachable = reachableNodes.has(tileKey(colIndex, rowIndex));
        // Gate checkmark only when path is complete AND Gate is on the path (glowing)
        const gateConnected = isGoal && showComplete && isReachable;
        let label: 'Spring' | 'Gate' | 'Gate ✓' | 'Switch' | undefined;
        if (isStart) label = 'Spring';
        else if (isGoal) label = gateConnected ? 'Gate ✓' : 'Gate';
        else if (isSwitch) label = 'Switch';
        return {
          col: colIndex,
          row: rowIndex,
          isActive: isReachable, // Cyan glow only if reachable from Spring — else dark
          hasFlower: !isStart && !isGoal && flowerTileKeySet.has(tileKey(colIndex, rowIndex)),
          hasObstacle: obstacleTileKeySet.has(tileKey(colIndex, rowIndex)),
          hasSwitch: isSwitch,
          label,
          openDirections: getTileOpenDirections(kind, puzzleRotations[rowIndex][colIndex]),
        };
      })
    );
  }, [activeLevel, puzzleRotations, reachableNodes, showComplete, flowerTileKeySet, obstacleTileKeySet, switchTileKeySet]);
  const isoBridgeDots = useMemo<BridgeDotData[]>(() => {
    return activeLevel.perspectiveLinks.map((link, index) => ({
      id: `plink-${index}`,
      aCol: link.a.x,
      aRow: link.a.y,
      bCol: link.b.x,
      bRow: link.b.y,
      active: isPerspectiveLinkActive(link, puzzleRotations),
    }));
  }, [activeLevel, puzzleRotations]);

  const breathingLabel = useMemo(() => {
    if (!isBreathing) return 'Ready to breathe';
    return 'Inhale... Exhale...';
  }, [isBreathing]);

  const selectLevel = (index: number, reason: 'manual_select' | 'next_level' = 'manual_select') => {
    if (selectedGame === 'puzzle' && reason === 'manual_select') {
      recordLevelTimeSpent('switch');
    }
    setActiveLevelIndex(index);
    const nextLevel = PUZZLE_LEVELS[index];
    setPuzzleRotations(ensureUnsolvedBoard(nextLevel, cloneRotations(nextLevel.initialRotations)));
    setMoves(0);
    setShowHint(false);
    levelStartedAtRef.current = Date.now();
    lastInteractionAtRef.current = Date.now();
    logGardenEvent({
      sessionSeed: GARDEN_SESSION_SEED,
      levelId: PUZZLE_LEVELS[index].id,
      eventType: 'level_started',
      payload: { levelSeed: PUZZLE_LEVELS[index].seed, via: reason },
    });
    scheduleIdleWindow();
  };

  const toggleBreathing = () => {
    if (isBreathing) {
      breathLoopRef.current?.stop();
      breathLoopRef.current = null;
      setIsBreathing(false);
      Animated.timing(orbScale, {
        toValue: 1,
        duration: 250,
        useNativeDriver: true,
      }).start();
      return;
    }

    const sequence = Animated.sequence([
      Animated.timing(orbScale, {
        toValue: 1.3,
        duration: 4200,
        easing: Easing.inOut(Easing.sin),
        useNativeDriver: true,
      }),
      Animated.timing(orbScale, {
        toValue: 1,
        duration: 4800,
        easing: Easing.inOut(Easing.sin),
        useNativeDriver: true,
      }),
    ]);

    const loop = Animated.loop(sequence);
    breathLoopRef.current = loop;
    setIsBreathing(true);
    loop.start();
  };

  const createRipple = (x: number, y: number) => {
    const id = Date.now() + Math.floor(Math.random() * 1000);
    const progress = new Animated.Value(0);
    const ripple: Ripple = { id, x, y, progress };

    setRipples((prev) => [...prev, ripple]);

    Animated.timing(progress, {
      toValue: 1,
      duration: 1500,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start(() => {
      setRipples((prev) => prev.filter((entry) => entry.id !== id));
    });
  };

  const rotatePuzzleTile = (row: number, col: number) => {
    const now = Date.now();
    const last = lastTileTapRef.current;
    if (last && last.row === row && last.col === col && now - last.time < 250) return;
    lastTileTapRef.current = { row, col, time: now };

    setPuzzleRotations((prev) =>
      prev.map((line, y) =>
        line.map((rotation, x) => {
          if (y !== row || x !== col) return rotation;
          return (rotation + 90) % 360;
        })
      )
    );
    setMoves((prev) => prev + 1);
    markInteraction('tile_rotate', {
      row,
      col,
      tileKey: tileKey(col, row),
      currentMove: moves + 1,
    });
  };

  const resetPuzzle = () => {
    logAnalytics('level_restart', { movesBeforeReset: moves });
    recordLevelTimeSpent('restart');
    setPuzzleRotations(ensureUnsolvedBoard(activeLevel, cloneRotations(activeLevel.initialRotations)));
    setMoves(0);
    levelStartedAtRef.current = Date.now();
    markInteraction('level_reset');
  };

  const goToNextLevel = () => {
    recordLevelTimeSpent('complete');
    const nextIndex = Math.min(activeLevelIndex + 1, PUZZLE_LEVELS.length - 1);
    selectLevel(nextIndex, 'next_level');
  };

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(ambienceDrift, {
          toValue: 1,
          duration: 4800,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(ambienceDrift, {
          toValue: 0,
          duration: 4800,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();

    return () => {
      breathLoopRef.current?.stop();
      loop.stop();
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    };
  }, [ambienceDrift, activeLevelIndex]);

  useEffect(() => {
    void markFeatureUsed('games').catch(() => undefined);
  }, []);

  useEffect(() => {
    const preSolved = getInitiallySolvedLevelIds();
    if (preSolved.length > 0) {
      console.warn('[Khido Games] Pre-solved levels detected and corrected:', preSolved);
    }
  }, []);

  useEffect(() => {
    if (selectedGame !== 'puzzle') return;

    levelStartedAtRef.current = Date.now();
    lastInteractionAtRef.current = Date.now();
    logAnalytics('level_started', { levelName: activeLevel.name });
    scheduleIdleWindow();

    return () => {
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    };
  }, [activeLevel.id, activeLevel.name, logAnalytics, scheduleIdleWindow, selectedGame]);

  useEffect(() => {
    if (selectedGame !== 'puzzle') return;
    if (!showComplete) return;
    if (completedLevelsRef.current.has(activeLevel.id)) return;

    completedLevelsRef.current.add(activeLevel.id);
    const completionMs = Date.now() - levelStartedAtRef.current;
    logAnalytics('level_completed', {
      completionMs,
      moves,
      expectedMoves: activeLevel.expectedMoves,
    });
    void recordGameCompletion().catch(() => undefined);
  }, [activeLevel.expectedMoves, activeLevel.id, logAnalytics, moves, selectedGame, showComplete]);

  useEffect(() => {
    const isFinalLevel = activeLevel.id === PUZZLE_LEVELS.length;
    if (!isFinalLevel || !showComplete) {
      rewardScreenShownRef.current = false;
      return;
    }
    if (rewardScreenShownRef.current) return;

    rewardScreenShownRef.current = true;
    router.push(Routes.GARDEN_REWARD);
  }, [activeLevel.id, showComplete]);

  const tileSize = tileSizeForLevel(activeLevel);
  const useIsoWorld = activeLevel.id >= 2;

  return (
    <SafeAreaView style={styles.container}>
      <ThemedView style={styles.background} lightColor="#7BAEF9" darkColor="#7BAEF9">
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.push(Routes.DASHBOARD)} style={styles.backButton} activeOpacity={0.7}>
            <MaterialIcons name="arrow-back" size={24} color="#FFFFFF" />
            <Text style={styles.backLabel}>Back</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Calm Games</Text>
        </View>

        <View style={styles.pickerWrap}>
          <TouchableOpacity
            style={[styles.pickerButton, selectedGame === 'breathing' && styles.pickerButtonSelected]}
            onPress={() => {
              if (selectedGame === 'puzzle') {
                recordLevelTimeSpent('leave_puzzle');
              }
              setSelectedGame('breathing');
            }}
            activeOpacity={0.75}>
            <Text style={styles.pickerText}>Breathing Orb</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.pickerButton, selectedGame === 'ripples' && styles.pickerButtonSelected]}
            onPress={() => {
              if (selectedGame === 'puzzle') {
                recordLevelTimeSpent('leave_puzzle');
              }
              setSelectedGame('ripples');
            }}
            activeOpacity={0.75}>
            <Text style={styles.pickerText}>Zen Ripples</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.pickerButton, selectedGame === 'puzzle' && styles.pickerButtonSelected]}
            onPress={() => {
              setSelectedGame('puzzle');
              scheduleIdleWindow();
            }}
            activeOpacity={0.75}>
            <Text style={styles.pickerText}>Path Garden</Text>
          </TouchableOpacity>
        </View>

        {selectedGame === 'breathing' ? (
          <View style={styles.gameWrap}>
            <Text style={styles.gameTitle}>Breathing Orb</Text>
            <Text style={styles.gameDescription}>Follow the orb: grow with inhale, relax with exhale.</Text>
            <Animated.View style={[styles.orb, { transform: [{ scale: orbScale }] }]} />
            <Text style={styles.breathingStatus}>{breathingLabel}</Text>
            <TouchableOpacity style={styles.primaryCta} onPress={toggleBreathing} activeOpacity={0.75}>
              <Text style={styles.primaryCtaText}>{isBreathing ? 'Pause Session' : 'Start Session'}</Text>
            </TouchableOpacity>
          </View>
        ) : selectedGame === 'ripples' ? (
          <View style={styles.gameWrap}>
            <Text style={styles.gameTitle}>Zen Ripples</Text>
            <Text style={styles.gameDescription}>Tap anywhere to create gentle water ripples.</Text>
            <TouchableOpacity
              style={styles.rippleField}
              activeOpacity={1}
              onPress={(event) => createRipple(event.nativeEvent.locationX, event.nativeEvent.locationY)}>
              {ripples.map((ripple) => (
                <Animated.View
                  key={ripple.id}
                  style={[
                    styles.ripple,
                    {
                      left: ripple.x - 20,
                      top: ripple.y - 20,
                      opacity: ripple.progress.interpolate({ inputRange: [0, 1], outputRange: [0.5, 0] }),
                      transform: [
                        {
                          scale: ripple.progress.interpolate({ inputRange: [0, 1], outputRange: [0.4, 5] }),
                        },
                      ],
                    },
                  ]}
                />
              ))}
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.gameWrapLarge}>
            <ScrollView
              style={styles.gameScroll}
              contentContainerStyle={styles.gameScrollContent}
              showsVerticalScrollIndicator={false}>
            <Text style={styles.gameTitle}>Path Garden</Text>
            <Text style={styles.gameDescription}>{activeLevel.vibe}</Text>

            <View style={styles.levelSelector}>
              {PUZZLE_LEVELS.map((level, index) => (
                <TouchableOpacity
                  key={level.id}
                  style={[styles.levelChip, index === activeLevelIndex && styles.levelChipActive]}
                  onPress={() => selectLevel(index)}
                  activeOpacity={0.8}>
                  <Text style={[styles.levelChipText, index === activeLevelIndex && styles.levelChipTextActive]}>
                    L{level.id}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity
              onPress={() => setShowHint((h) => !h)}
              style={styles.hintToggle}
              activeOpacity={0.8}>
              <MaterialIcons name={showHint ? 'expand-less' : 'help-outline'} size={20} color="#1D4ED8" />
              <Text style={styles.hintToggleText}>{showHint ? 'Hide directions' : 'Directions'}</Text>
            </TouchableOpacity>

            {showHint && (
              <View style={styles.goalPreview}>
                <Text style={styles.goalTitle}>How to play</Text>
                <Text style={styles.goalTextSimple}>
                  Tap any tile to rotate its pipes. Every tile rotates when you tap it.
                </Text>
                <Text style={styles.goalTextSimple}>
                  Connect the pipes from Spring to Gate. When pipes line up between two tiles, water flows — and that part of the path glows.
                </Text>
                <Text style={styles.goalTextSimple}>
                  You win when the whole path from Spring to Gate is glowing. Take your time.
                </Text>
                {activeLevel.perspectiveLinks.length > 0 && (
                  <Text style={styles.goalTextBridge}>
                    Stone bridges connect distant towers. Rotate the tile marked Switch (gold label) to activate the crossing.
                  </Text>
                )}
                <View style={styles.goalDiagram}>
                  <View style={styles.goalRow}>
                    <View style={styles.goalTileWrap}>
                      <Text style={styles.goalLabelSpring}>Spring</Text>
                      <View style={styles.goalTile}>
                        <View style={styles.goalChannelH} />
                      </View>
                    </View>
                    <View style={styles.goalArrow}>
                      <MaterialIcons name="arrow-forward" size={16} color="#4DB8C4" />
                    </View>
                    <View style={styles.goalTile}>
                      <View style={styles.goalChannelH} />
                    </View>
                    <View style={styles.goalArrow}>
                      <MaterialIcons name="arrow-forward" size={16} color="#4DB8C4" />
                    </View>
                    <View style={styles.goalTileWrap}>
                      <Text style={styles.goalLabelGate}>Gate</Text>
                      <View style={styles.goalTile}>
                        <View style={styles.goalChannelH} />
                      </View>
                    </View>
                  </View>
                </View>
              </View>
            )}

            <View style={styles.puzzleHeaderRow}>
              <View style={styles.puzzleBadge}>
                <Text style={styles.puzzleBadgeText}>Moves: {moves}</Text>
              </View>
              <View style={styles.puzzleBadgeMuted}>
                <Text style={styles.puzzleBadgeMutedText}>Suggested: {activeLevel.expectedMoves} moves</Text>
              </View>
              <TouchableOpacity onPress={resetPuzzle} activeOpacity={0.75} style={styles.secondaryCta}>
                <Text style={styles.secondaryCtaText}>Reset</Text>
              </TouchableOpacity>
            </View>

            <View
              style={[
                styles.gardenWorld,
                useIsoWorld && styles.gameBoardWrapper,
                useIsoWorld && {
                  backgroundColor: activeLevel.theme.skyColors[1],
                  borderColor: activeLevel.theme.stoneColors[1],
                },
              ]}>
              <Animated.View
                style={[
                  styles.ambientCloud,
                  {
                    transform: [
                      {
                        translateX: ambienceDrift.interpolate({ inputRange: [0, 1], outputRange: [-6, 8] }),
                      },
                    ],
                  },
                ]}
              />
              <Animated.View
                style={[
                  styles.ambientCloud2,
                  {
                    transform: [
                      {
                        translateX: ambienceDrift.interpolate({ inputRange: [0, 1], outputRange: [8, -8] }),
                      },
                    ],
                  },
                ]}
              />

              {!useIsoWorld && (
                <View style={styles.puzzleGridFlat}>
                  {activeLevel.layout.map((row, rowIndex) => (
                    <View key={`row-${rowIndex}`} style={styles.puzzleRowFlat}>
                      {row.map((kind, colIndex) => {
                        const dirs = getTileOpenDirections(kind, puzzleRotations[rowIndex][colIndex]);
                        // Glow ONLY for tiles reachable from Spring (strict BFS)
                        const isReachable = reachableNodes.has(tileKey(colIndex, rowIndex));
                        const isStart = rowIndex === activeLevel.start.y && colIndex === activeLevel.start.x;
                        const isGoal = rowIndex === activeLevel.goal.y && colIndex === activeLevel.goal.x;
                        const gateConnected = isGoal && showComplete && isReachable;
                        const hasObstacle = obstacleTileKeySet.has(tileKey(colIndex, rowIndex));

                        return (
                          <TouchableOpacity
                            key={`tile-${rowIndex}-${colIndex}`}
                            style={[
                              styles.puzzleTileFlat,
                              { width: tileSize, height: tileSize },
                              isReachable && styles.puzzleTileReachable,
                              isStart && styles.tileStart,
                              isGoal && styles.tileGoal,
                            ]}
                            onPress={() => rotatePuzzleTile(rowIndex, colIndex)}
                            activeOpacity={0.85}
                            hitSlop={{ top: 16, bottom: 16, left: 16, right: 16 }}>
                            <View style={styles.tileSurfaceFlat}>
                              {dirs.includes('N') && <View style={[styles.channel, styles.channelN]} />}
                              {dirs.includes('E') && <View style={[styles.channel, styles.channelE]} />}
                              {dirs.includes('S') && <View style={[styles.channel, styles.channelS]} />}
                              {dirs.includes('W') && <View style={[styles.channel, styles.channelW]} />}
                              <View style={styles.channelCenter} />
                              {hasObstacle && <View style={styles.tileObstacleFlat} />}
                              {isStart && (
                                <View style={[styles.flatTileLabel, styles.flatTileLabelSpring]}>
                                  <Text style={styles.flatTileLabelText}>Spring</Text>
                                </View>
                              )}
                              {isGoal && (
                                <View style={[
                                  styles.flatTileLabel,
                                  styles.flatTileLabelGate,
                                  gateConnected && styles.flatTileLabelGateConnected,
                                ]}>
                                  <Text style={styles.flatTileLabelText}>{gateConnected ? 'Gate ✓' : 'Gate'}</Text>
                                </View>
                              )}
                            </View>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  ))}
                </View>
              )}

              {useIsoWorld && (
                <IsoBoard
                  tiles={isoTiles}
                  bridgeDots={isoBridgeDots}
                  theme={activeLevel.theme}
                  onTilePress={(col, row) => rotatePuzzleTile(row, col)}
                  labelsInsideTiles={true}
                />
              )}

              {activeLevel.perspectiveLinks.length > 0 && (
                <View style={styles.linkLegend}>
                  <MaterialIcons name="auto-awesome" size={14} color="#2E7CA3" />
                  <Text style={styles.linkLegendText}>The stone bridge connects two towers. Rotate the tile marked Switch to activate it.</Text>
                </View>
              )}

              <View style={[styles.worldGround, { backgroundColor: activeLevel.theme.groundColor }]}>
                <MaterialIcons name="park" size={18} color="#4C8E61" />
                <MaterialIcons name="local-florist" size={18} color="#769E43" />
                <MaterialIcons name="spa" size={18} color="#4F9C80" />
              </View>
            </View>

            <Text style={[styles.puzzleStatus, showComplete && styles.puzzleStatusSolved]}>
              {showComplete ? 'Path complete. Calm flow restored.' : 'Rotate tiles to connect Spring to Gate. The path glows when it connects.'}
            </Text>

            {showComplete && (
              <View style={styles.completionActions}>
                {activeLevelIndex < PUZZLE_LEVELS.length - 1 ? (
                  <TouchableOpacity onPress={goToNextLevel} style={styles.primaryCta} activeOpacity={0.8}>
                    <MaterialIcons name="arrow-forward" size={18} color="#FFFFFF" />
                    <Text style={styles.primaryCtaText}>Unlock Next Level</Text>
                  </TouchableOpacity>
                ) : (
                  <View style={styles.allCompleteWrap}>
                    <MaterialIcons name="celebration" size={24} color="#1A6B4A" />
                    <Text style={styles.allCompleteText}>All 14 levels complete!</Text>
                  </View>
                )}
              </View>
            )}
            </ScrollView>
          </View>
        )}
      </ThemedView>
    </SafeAreaView>
  );
}
