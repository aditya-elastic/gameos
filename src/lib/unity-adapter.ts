import fs from "node:fs";
import path from "node:path";
import { getProjectArtifactRoot, toProjectRelativeArtifactPath } from "./artifacts";
import { createCapabilityMap } from "./capability-graph";
import { createAcceptanceProfile } from "./trust";
import type { ProjectWorkspace } from "./types";

const unityEditorVersion = "6000.4.7f1";
const controllerGuid = "7f2f2a5d6b0e44a29f5d3c1a95b1e001";
const sceneGuid = "f7b99342cb9b4e7ba43f62e9cb77e901";

export type UnityAdapterResult = {
  projectRoot: string;
  files: string[];
  report: string;
};

export function generateUnityProject(workspace: ProjectWorkspace): UnityAdapterResult {
  const projectRoot = path.join(getProjectArtifactRoot(workspace.project.id), "unity");
  const files = [
    ["ProjectSettings/ProjectVersion.txt", renderProjectVersion()],
    ["ProjectSettings/EditorBuildSettings.asset", renderEditorBuildSettings()],
    ["Packages/manifest.json", renderPackageManifest()],
    ["Assets/Scenes/Main.unity", renderMainScene()],
    ["Assets/Scenes/Main.unity.meta", renderDefaultMeta(sceneGuid)],
    ["Assets/Scripts/TurnRulesEngine.cs", renderTurnRulesEngineScript()],
    ["Assets/Scripts/TurnRulesEngine.cs.meta", renderMeta("e54cf9f37a7041c7a2e4fb82a6bd4001")],
    ["Assets/Scripts/TurnRulesUnityController.cs", renderUnityControllerScript(workspace)],
    ["Assets/Scripts/TurnRulesUnityController.cs.meta", renderMeta(controllerGuid)],
    ["Assets/Editor/GameOsUnitySmoke.cs", renderSmokeScript()],
    ["Assets/Editor/GameOsUnitySmoke.cs.meta", renderMeta("1f9080d35c6c4cfb8c1e016afae05001")],
    ["Assets/Editor/GameOsUnityPlayerAgent.cs", renderPlayerAgentScript()],
    ["Assets/Editor/GameOsUnityPlayerAgent.cs.meta", renderMeta("9052e1f1f5334e529171f0f5dbea5001")],
    ["Assets/Editor/GameOsUnityAdvancedPlaytest.cs", renderAdvancedPlaytestScript()],
    ["Assets/Editor/GameOsUnityAdvancedPlaytest.cs.meta", renderMeta("ca7153d717a04a43a87087d3547c4001")],
    ["Docs/game-os-brief.md", renderUnityBrief(workspace)],
    ["unity-adapter-manifest.json", renderAdapterManifest(workspace)]
  ] as const;

  for (const [relativePath, content] of files) {
    const absolutePath = path.join(projectRoot, relativePath);
    fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
    fs.writeFileSync(absolutePath, content, "utf8");
  }

  const absoluteFiles = files.map(([relativePath]) => path.join(projectRoot, relativePath));

  return {
    projectRoot,
    files: absoluteFiles,
    report: renderUnityReport(workspace, projectRoot, absoluteFiles)
  };
}

function renderProjectVersion(): string {
  return [`m_EditorVersion: ${unityEditorVersion}`, "m_EditorVersionWithRevision: 6000.4.7f1 (0)"].join("\n") + "\n";
}

function renderPackageManifest(): string {
  return `${JSON.stringify(
    {
      dependencies: {
        "com.unity.modules.ai": "1.0.0",
        "com.unity.modules.androidjni": "1.0.0",
        "com.unity.modules.assetbundle": "1.0.0",
        "com.unity.modules.audio": "1.0.0",
        "com.unity.modules.imageconversion": "1.0.0",
        "com.unity.modules.imgui": "1.0.0",
        "com.unity.modules.jsonserialize": "1.0.0",
        "com.unity.modules.physics": "1.0.0",
        "com.unity.modules.ui": "1.0.0",
        "com.unity.modules.uielements": "1.0.0"
      }
    },
    null,
    2
  )}\n`;
}

function renderEditorBuildSettings(): string {
  return [
    "%YAML 1.1",
    "%TAG !u! tag:unity3d.com,2011:",
    "--- !u!1045 &1",
    "EditorBuildSettings:",
    "  m_ObjectHideFlags: 0",
    "  serializedVersion: 2",
    "  m_Scenes:",
    "  - enabled: 1",
    "    path: Assets/Scenes/Main.unity",
    `    guid: ${sceneGuid}`,
    "  m_configObjects: {}"
  ].join("\n") + "\n";
}

function renderMainScene(): string {
  return [
    "%YAML 1.1",
    "%TAG !u! tag:unity3d.com,2011:",
    "--- !u!29 &1",
    "OcclusionCullingSettings:",
    "  m_ObjectHideFlags: 0",
    "  serializedVersion: 2",
    "  m_OcclusionBakeSettings:",
    "    smallestOccluder: 5",
    "    smallestHole: 0.25",
    "    backfaceThreshold: 100",
    "  m_SceneGUID: 00000000000000000000000000000000",
    "  m_OcclusionCullingData: {fileID: 0}",
    "--- !u!104 &2",
    "RenderSettings:",
    "  m_ObjectHideFlags: 0",
    "  serializedVersion: 10",
    "  m_Fog: 0",
    "  m_AmbientSkyColor: {r: 0.18, g: 0.2, b: 0.23, a: 1}",
    "  m_AmbientEquatorColor: {r: 0.1, g: 0.11, b: 0.13, a: 1}",
    "  m_AmbientGroundColor: {r: 0.04, g: 0.04, b: 0.04, a: 1}",
    "  m_AmbientIntensity: 1",
    "  m_AmbientMode: 0",
    "  m_SubtractiveShadowColor: {r: 0.42, g: 0.47, b: 0.54, a: 1}",
    "--- !u!157 &3",
    "LightmapSettings:",
    "  m_ObjectHideFlags: 0",
    "  serializedVersion: 12",
    "  m_GIWorkflowMode: 1",
    "  m_GISettings:",
    "    serializedVersion: 2",
    "    m_BounceScale: 1",
    "    m_IndirectOutputScale: 1",
    "    m_AlbedoBoost: 1",
    "    m_EnvironmentLightingMode: 0",
    "    m_EnableBakedLightmaps: 1",
    "    m_EnableRealtimeLightmaps: 0",
    "--- !u!196 &4",
    "NavMeshSettings:",
    "  serializedVersion: 2",
    "  m_ObjectHideFlags: 0",
    "  m_BuildSettings:",
    "    serializedVersion: 3",
    "    agentTypeID: 0",
    "    agentRadius: 0.5",
    "    agentHeight: 2",
    "    agentSlope: 45",
    "    agentClimb: 0.4",
    "    ledgeDropHeight: 0",
    "    maxJumpAcrossDistance: 0",
    "    minRegionArea: 2",
    "    manualCellSize: 0",
    "    cellSize: 0.16666667",
    "    manualTileSize: 0",
    "    tileSize: 256",
    "    buildHeightMesh: 0",
    "    maxJobWorkers: 0",
    "    preserveTilesOutsideBounds: 0",
    "    debug:",
    "      m_Flags: 0",
    "  m_NavMeshData: {fileID: 0}",
    "--- !u!1 &100000",
    "GameObject:",
    "  m_ObjectHideFlags: 0",
    "  m_CorrespondingSourceObject: {fileID: 0}",
    "  m_PrefabInstance: {fileID: 0}",
    "  m_PrefabAsset: {fileID: 0}",
    "  serializedVersion: 6",
    "  m_Component:",
    "  - component: {fileID: 100001}",
    "  - component: {fileID: 100002}",
    "  m_Layer: 0",
    "  m_Name: Game OS Unity Controller",
    "  m_TagString: Untagged",
    "  m_Icon: {fileID: 0}",
    "  m_NavMeshLayer: 0",
    "  m_StaticEditorFlags: 0",
    "  m_IsActive: 1",
    "--- !u!4 &100001",
    "Transform:",
    "  m_ObjectHideFlags: 0",
    "  m_CorrespondingSourceObject: {fileID: 0}",
    "  m_PrefabInstance: {fileID: 0}",
    "  m_PrefabAsset: {fileID: 0}",
    "  m_GameObject: {fileID: 100000}",
    "  serializedVersion: 2",
    "  m_LocalRotation: {x: 0, y: 0, z: 0, w: 1}",
    "  m_LocalPosition: {x: 0, y: 0, z: 0}",
    "  m_LocalScale: {x: 1, y: 1, z: 1}",
    "  m_ConstrainProportionsScale: 0",
    "  m_Children: []",
    "  m_Father: {fileID: 0}",
    "  m_LocalEulerAnglesHint: {x: 0, y: 0, z: 0}",
    "--- !u!114 &100002",
    "MonoBehaviour:",
    "  m_ObjectHideFlags: 0",
    "  m_CorrespondingSourceObject: {fileID: 0}",
    "  m_PrefabInstance: {fileID: 0}",
    "  m_PrefabAsset: {fileID: 0}",
    "  m_GameObject: {fileID: 100000}",
    "  m_Enabled: 1",
    "  m_EditorHideFlags: 0",
    `  m_Script: {fileID: 11500000, guid: ${controllerGuid}, type: 3}`,
    "  m_Name: ",
    "  m_EditorClassIdentifier: "
  ].join("\n") + "\n";
}

function renderMeta(guid: string): string {
  return [
    "fileFormatVersion: 2",
    `guid: ${guid}`,
    "MonoImporter:",
    "  externalObjects: {}",
    "  serializedVersion: 2",
    "  defaultReferences: []",
    "  executionOrder: 0",
    "  icon: {instanceID: 0}",
    "  userData: ",
    "  assetBundleName: ",
    "  assetBundleVariant: "
  ].join("\n") + "\n";
}

function renderDefaultMeta(guid: string): string {
  return [
    "fileFormatVersion: 2",
    `guid: ${guid}`,
    "DefaultImporter:",
    "  externalObjects: {}",
    "  userData: ",
    "  assetBundleName: ",
    "  assetBundleVariant: "
  ].join("\n") + "\n";
}

function renderTurnRulesEngineScript(): string {
  return String.raw`using System;
using System.Collections.Generic;

namespace GameOS.UnityAdapter
{
    public enum TurnRulesPhase
    {
        AwaitRoll,
        SelectToken,
        EndMatch
    }

    [Serializable]
    public sealed class TurnRulesToken
    {
        public int Steps = -1;
        public bool Home;
    }

    [Serializable]
    public sealed class TurnRulesPlayer
    {
        public int Id;
        public string Color = "";
        public List<TurnRulesToken> Tokens = new List<TurnRulesToken>();
    }

    [Serializable]
    public sealed class MoveRecord
    {
        public int Player;
        public int Token;
        public int Dice;
        public List<string> Events = new List<string>();
    }

    [Serializable]
    public sealed class TurnRulesState
    {
        public int PlayerCount;
        public int Turn;
        public int Dice;
        public TurnRulesPhase Phase = TurnRulesPhase.AwaitRoll;
        public int Winner = -1;
        public int WinTokenTarget = TurnRulesEngine.TokenCount;
        public List<TurnRulesPlayer> Players = new List<TurnRulesPlayer>();
        public List<MoveRecord> MoveHistory = new List<MoveRecord>();
    }

    public sealed class MoveResult
    {
        public bool Ok;
        public string Reason = "";
        public List<int> LegalMoves = new List<int>();
        public List<string> Events = new List<string>();

        public static MoveResult Pass(List<int> legalMoves = null, List<string> events = null)
        {
            return new MoveResult
            {
                Ok = true,
                LegalMoves = legalMoves ?? new List<int>(),
                Events = events ?? new List<string>()
            };
        }

        public static MoveResult Fail(string reason, List<int> legalMoves = null)
        {
            return new MoveResult
            {
                Ok = false,
                Reason = reason,
                LegalMoves = legalMoves ?? new List<int>()
            };
        }
    }

    public struct TokenCounts
    {
        public int Base;
        public int Active;
        public int Home;
    }

    public sealed class TurnRulesEngine
    {
        public const int TokenCount = 4;
        public const int TrackLength = 52;
        public const int HomeLength = 6;
        public const int FinishSteps = TrackLength + HomeLength - 1;

        private static readonly string[] PlayerColors = { "red", "blue", "green", "yellow" };
        private static readonly int[] StartOffsets = { 0, 13, 26, 39 };
        private static readonly HashSet<int> SafeSquares = new HashSet<int> { 0, 8, 13, 21, 26, 34, 39, 47 };

        public TurnRulesState CreateInitialState(int playerCount = 4, int winTokenTarget = 2)
        {
            playerCount = Clamp(playerCount, 2, 4);
            winTokenTarget = Clamp(winTokenTarget, 1, TokenCount);

            var state = new TurnRulesState
            {
                PlayerCount = playerCount,
                WinTokenTarget = winTokenTarget
            };

            for (var playerIndex = 0; playerIndex < playerCount; playerIndex++)
            {
                var player = new TurnRulesPlayer
                {
                    Id = playerIndex,
                    Color = PlayerColors[playerIndex]
                };

                for (var tokenIndex = 0; tokenIndex < TokenCount; tokenIndex++)
                {
                    player.Tokens.Add(new TurnRulesToken());
                }

                state.Players.Add(player);
            }

            return state;
        }

        public MoveResult Roll(TurnRulesState state, int diceValue)
        {
            if (state.Phase == TurnRulesPhase.EndMatch)
            {
                return MoveResult.Fail("match_complete");
            }

            if (diceValue < 1 || diceValue > 6)
            {
                return MoveResult.Fail("invalid_dice");
            }

            state.Dice = diceValue;
            state.Phase = TurnRulesPhase.SelectToken;
            return MoveResult.Pass(GetLegalMoves(state));
        }

        public List<int> GetLegalMoves(TurnRulesState state)
        {
            var legal = new List<int>();
            if (state.Phase == TurnRulesPhase.AwaitRoll)
            {
                return legal;
            }

            var player = state.Players[state.Turn];
            for (var tokenIndex = 0; tokenIndex < player.Tokens.Count; tokenIndex++)
            {
                var token = player.Tokens[tokenIndex];
                if (token.Home)
                {
                    continue;
                }

                if (token.Steps == -1)
                {
                    if (state.Dice == 6)
                    {
                        legal.Add(tokenIndex);
                    }
                }
                else if (token.Steps + state.Dice <= FinishSteps)
                {
                    legal.Add(tokenIndex);
                }
            }

            return legal;
        }

        public MoveResult ApplyMove(TurnRulesState state, int tokenIndex)
        {
            var legal = GetLegalMoves(state);
            if (!legal.Contains(tokenIndex))
            {
                return MoveResult.Fail("illegal_move", legal);
            }

            var playerIndex = state.Turn;
            var player = state.Players[playerIndex];
            var token = player.Tokens[tokenIndex];
            var events = new List<string>();

            if (token.Steps == -1)
            {
                token.Steps = 0;
                events.Add("released_from_base");
            }
            else
            {
                token.Steps += state.Dice;
            }

            if (token.Steps == FinishSteps)
            {
                token.Home = true;
                events.Add("home");
            }
            else if (token.Steps < TrackLength)
            {
                events.AddRange(ResolveCapture(state, playerIndex, token.Steps));
            }

            state.MoveHistory.Add(new MoveRecord
            {
                Player = playerIndex,
                Token = tokenIndex,
                Dice = state.Dice,
                Events = new List<string>(events)
            });

            if (PlayerComplete(state, player))
            {
                state.Phase = TurnRulesPhase.EndMatch;
                state.Winner = playerIndex;
            }
            else if (state.Dice == 6)
            {
                state.Phase = TurnRulesPhase.AwaitRoll;
            }
            else
            {
                state.Turn = (state.Turn + 1) % state.PlayerCount;
                state.Phase = TurnRulesPhase.AwaitRoll;
            }

            state.Dice = 0;
            return MoveResult.Pass(null, events);
        }

        public MoveResult PassTurn(TurnRulesState state)
        {
            if (GetLegalMoves(state).Count > 0)
            {
                return MoveResult.Fail("legal_move_exists");
            }

            state.MoveHistory.Add(new MoveRecord
            {
                Player = state.Turn,
                Token = -1,
                Dice = state.Dice,
                Events = new List<string> { "no_legal_move" }
            });
            state.Turn = (state.Turn + 1) % state.PlayerCount;
            state.Dice = 0;
            state.Phase = TurnRulesPhase.AwaitRoll;
            return MoveResult.Pass();
        }

        public int BoardPosition(int playerIndex, int steps)
        {
            if (steps < 0 || steps >= TrackLength)
            {
                return -1;
            }

            return (StartOffsets[playerIndex] + steps) % TrackLength;
        }

        public bool IsSafeSquare(int position)
        {
            return SafeSquares.Contains(position);
        }

        public TokenCounts CountTokens(TurnRulesPlayer player)
        {
            var counts = new TokenCounts();
            foreach (var token in player.Tokens)
            {
                if (token.Home)
                {
                    counts.Home++;
                }
                else if (token.Steps == -1)
                {
                    counts.Base++;
                }
                else
                {
                    counts.Active++;
                }
            }

            return counts;
        }

        private List<string> ResolveCapture(TurnRulesState state, int playerIndex, int steps)
        {
            var events = new List<string>();
            var position = BoardPosition(playerIndex, steps);
            if (IsSafeSquare(position))
            {
                events.Add("safe_square");
                return events;
            }

            for (var otherIndex = 0; otherIndex < state.Players.Count; otherIndex++)
            {
                if (otherIndex == playerIndex)
                {
                    continue;
                }

                foreach (var otherToken in state.Players[otherIndex].Tokens)
                {
                    if (otherToken.Home || otherToken.Steps < 0 || otherToken.Steps >= TrackLength)
                    {
                        continue;
                    }

                    if (BoardPosition(otherIndex, otherToken.Steps) == position)
                    {
                        otherToken.Steps = -1;
                        otherToken.Home = false;
                        events.Add("capture");
                    }
                }
            }

            return events;
        }

        private bool PlayerComplete(TurnRulesState state, TurnRulesPlayer player)
        {
            return CountTokens(player).Home >= state.WinTokenTarget;
        }

        private static int Clamp(int value, int min, int max)
        {
            if (value < min)
            {
                return min;
            }

            return value > max ? max : value;
        }
    }
}
`;
}

function renderUnityControllerScript(workspace: ProjectWorkspace): string {
  const doctrine = engineDoctrine(workspace);
  return `using System;
using System.Collections.Generic;
using UnityEngine;

namespace GameOS.UnityAdapter
{
    public sealed class TurnRulesUnityController : MonoBehaviour
    {
        public const string GameOsWatermarkLabel = "Made with GameOS";

        private readonly TurnRulesEngine rules = new TurnRulesEngine();
        private readonly System.Random rng = new System.Random();
        private TurnRulesState state;
        private string lastEvent = "New Unity match ready.";
        private bool botsEnabled = true;
        private float nextBotStep;

        public string WatermarkText => GameOsWatermarkLabel;

        private void Start()
        {
            NewMatch();
        }

        private void Update()
        {
            if (!botsEnabled || state == null || state.Phase == TurnRulesPhase.EndMatch || state.Turn == 0 || Time.time < nextBotStep)
            {
                return;
            }

            RunBotStep();
            nextBotStep = Time.time + 0.45f;
        }

        private void OnGUI()
        {
            if (state == null)
            {
                NewMatch();
            }

            GUILayout.BeginArea(new Rect(24, 20, 640, Screen.height - 40), GUI.skin.box);
            GUILayout.Label("${escapeCSharpString(workspace.project.name)} - Unity Capability Test Lane");
            GUILayout.Label("Primary archetype: ${escapeCSharpString(doctrine.primaryArchetype)}");
            GUILayout.Label("First " + state.WinTokenTarget + " tokens home wins. Turn: " + CurrentPlayer().Color + (state.Turn == 0 ? " (human)" : " (bot)") + " Phase: " + state.Phase + " Dice: " + state.Dice);
            GUILayout.Label("Last event: " + lastEvent);

            GUILayout.BeginHorizontal();
            GUI.enabled = state.Phase == TurnRulesPhase.AwaitRoll && state.Turn == 0;
            if (GUILayout.Button("Roll Dice", GUILayout.Width(130), GUILayout.Height(40)))
            {
                RollHuman();
            }

            GUI.enabled = state.Phase == TurnRulesPhase.SelectToken && state.Turn == 0 && rules.GetLegalMoves(state).Count == 0;
            if (GUILayout.Button("Pass Turn", GUILayout.Width(130), GUILayout.Height(40)))
            {
                PassCurrent();
            }

            GUI.enabled = true;
            if (GUILayout.Button("New Match", GUILayout.Width(130), GUILayout.Height(40)))
            {
                NewMatch();
            }

            botsEnabled = GUILayout.Toggle(botsEnabled, " Bots", GUILayout.Width(90));
            GUILayout.EndHorizontal();

            if (state.Phase == TurnRulesPhase.SelectToken && state.Turn == 0)
            {
                var legal = rules.GetLegalMoves(state);
                GUILayout.Label("Legal moves: " + string.Join(", ", legal));
                GUILayout.BeginHorizontal();
                foreach (var tokenIndex in legal)
                {
                    if (GUILayout.Button("Move token " + (tokenIndex + 1), GUILayout.Width(130), GUILayout.Height(34)))
                    {
                        MoveToken(tokenIndex);
                    }
                }
                GUILayout.EndHorizontal();
            }

            GUILayout.Space(10);
            foreach (var player in state.Players)
            {
                var counts = rules.CountTokens(player);
                GUILayout.Label(player.Color.ToUpperInvariant() + " | base " + counts.Base + " | active " + counts.Active + " | home " + counts.Home);
            }

            if (state.Phase == TurnRulesPhase.EndMatch)
            {
                GUILayout.Label("Winner: " + state.Players[state.Winner].Color.ToUpperInvariant());
            }

            GUILayout.EndArea();

            var previousAlignment = GUI.skin.label.alignment;
            GUI.skin.label.alignment = TextAnchor.MiddleRight;
            GUI.Label(new Rect(Math.Max(24, Screen.width - 224), Math.Max(24, Screen.height - 44), 200, 24), GameOsWatermarkLabel);
            GUI.skin.label.alignment = previousAlignment;
        }

        private void NewMatch()
        {
            state = rules.CreateInitialState(4, 2);
            lastEvent = "Capability proof sprint ready.";
            nextBotStep = Time.time + 0.5f;
        }

        private void RollHuman()
        {
            var dice = rng.Next(1, 7);
            rules.Roll(state, dice);
            lastEvent = "Human rolled " + dice + ".";
        }

        private void PassCurrent()
        {
            var player = CurrentPlayer();
            rules.PassTurn(state);
            lastEvent = player.Color + " passed: no legal move.";
        }

        private void MoveToken(int tokenIndex)
        {
            var player = CurrentPlayer();
            var result = rules.ApplyMove(state, tokenIndex);
            lastEvent = player.Color + " moved token " + (tokenIndex + 1) + ": " + string.Join(", ", result.Events);
        }

        private void RunBotStep()
        {
            if (state.Phase == TurnRulesPhase.AwaitRoll)
            {
                var dice = rng.Next(1, 7);
                rules.Roll(state, dice);
                lastEvent = CurrentPlayer().Color + " bot rolled " + dice + ".";
                return;
            }

            var legal = rules.GetLegalMoves(state);
            if (legal.Count == 0)
            {
                PassCurrent();
                return;
            }

            MoveToken(ChooseBotMove(legal));
        }

        private int ChooseBotMove(List<int> legal)
        {
            var player = CurrentPlayer();
            foreach (var tokenIndex in legal)
            {
                if (player.Tokens[tokenIndex].Steps + state.Dice == TurnRulesEngine.FinishSteps)
                {
                    return tokenIndex;
                }
            }

            foreach (var tokenIndex in legal)
            {
                if (player.Tokens[tokenIndex].Steps == -1)
                {
                    return tokenIndex;
                }
            }

            return legal[0];
        }

        private TurnRulesPlayer CurrentPlayer()
        {
            return state.Players[state.Turn];
        }
    }
}
`;
}

function renderSmokeScript(): string {
  return String.raw`using System;
using GameOS.UnityAdapter;
using UnityEditor;
using UnityEngine;

namespace GameOS.Editor
{
    public static class GameOsUnitySmoke
    {
        public static void Run()
        {
            try
            {
                var rules = new TurnRulesEngine();
                var state = rules.CreateInitialState(2);
                Expect(state.PlayerCount == 2, "two-player state");
                Expect(rules.Roll(state, 6).Ok, "roll six");
                Expect(rules.GetLegalMoves(state).Contains(0), "six releases token");
                Expect(rules.ApplyMove(state, 0).Ok, "apply release");
                Expect(state.Turn == 0, "six grants extra turn");
                Expect(rules.Roll(state, 3).Ok, "roll three");
                Expect(rules.ApplyMove(state, 0).Ok, "move token");
                Expect(state.Turn == 1, "non-six advances turn");

                state = rules.CreateInitialState(2);
                state.Players[0].Tokens[0].Steps = 4;
                state.Players[1].Tokens[0].Steps = 44;
                state.Turn = 0;
                Expect(rules.Roll(state, 1).Ok, "roll for capture");
                var capture = rules.ApplyMove(state, 0);
                Expect(capture.Events.Contains("capture"), "capture event");
                Expect(state.Players[1].Tokens[0].Steps == -1, "captured token returns to base");

                state = rules.CreateInitialState(2);
                state.Players[0].Tokens[0].Steps = 55;
                state.Turn = 0;
                Expect(rules.Roll(state, 2).Ok, "roll exact home");
                Expect(rules.ApplyMove(state, 0).Events.Contains("home"), "exact home entry");
                Expect(state.Players[0].Tokens[0].Home, "token marked home");

                state = rules.CreateInitialState(2);
                Expect(rules.Roll(state, 3).Ok, "roll no legal move");
                Expect(rules.GetLegalMoves(state).Count == 0, "base token cannot move without six");
                Expect(rules.PassTurn(state).Ok, "pass no legal move");

                var packed = JsonUtility.ToJson(state);
                var restored = JsonUtility.FromJson<TurnRulesState>(packed);
                Expect(restored.Turn == state.Turn, "json save resume turn");
                Expect(TurnRulesUnityController.GameOsWatermarkLabel.Contains("GameOS"), "watermark label");

                Debug.Log("UNITY_ADAPTER_SMOKE: PASS");
                EditorApplication.Exit(0);
            }
            catch (Exception error)
            {
                Debug.LogError("UNITY_ADAPTER_SMOKE failed: " + error.Message);
                EditorApplication.Exit(1);
            }
        }

        private static void Expect(bool condition, string label)
        {
            if (!condition)
            {
                throw new InvalidOperationException(label);
            }
        }
    }
}
`;
}

function renderPlayerAgentScript(): string {
  return String.raw`using System;
using System.Collections.Generic;
using GameOS.UnityAdapter;
using UnityEditor;
using UnityEngine;

namespace GameOS.Editor
{
    public static class GameOsUnityPlayerAgent
    {
        private static readonly TurnRulesEngine Rules = new TurnRulesEngine();
        private static readonly System.Random Rng = new System.Random(20260531);

        public static void Run()
        {
            var totalTurns = 0;
            var captures = 0;
            var releases = 0;
            var homes = 0;
            var passes = 0;
            var timeouts = 0;
            const int matches = 8;

            for (var matchIndex = 0; matchIndex < matches; matchIndex++)
            {
                var match = PlayMatch();
                totalTurns += match.Turns;
                captures += match.Captures;
                releases += match.Releases;
                homes += match.Homes;
                passes += match.Passes;
                if (match.Timeout)
                {
                    timeouts++;
                }
            }

            var averageTurns = (float)totalTurns / matches;
            var worth = timeouts == 0 && averageTurns <= 360f && releases >= 12 && homes >= 8 && passes > 0;
            var verdict = worth ? "ENGINE_RULES_PLAYER_PROOF_PASS" : "NEEDS_ARCHITECTURE_UPGRADE";
            Debug.Log("UNITY_PLAYER_AGENT_REPORT: {\"agent\":\"Advanced Player Council - Unity Engine Lane\",\"claim\":\"capability-backed local engine player-agent simulation\",\"matches\":" + matches + ",\"average_turns\":" + averageTurns.ToString("0.0", System.Globalization.CultureInfo.InvariantCulture) + ",\"captures\":" + captures + ",\"releases\":" + releases + ",\"homes\":" + homes + ",\"passes\":" + passes + ",\"timeouts\":" + timeouts + ",\"verdict\":\"" + verdict + "\"}");
            EditorApplication.Exit(worth ? 0 : 2);
        }

        private static MatchReport PlayMatch()
        {
            var state = Rules.CreateInitialState(4, 2);
            var report = new MatchReport();

            while (state.Phase != TurnRulesPhase.EndMatch && report.Turns < 360)
            {
                report.Turns++;
                Rules.Roll(state, Rng.Next(1, 7));
                var legal = Rules.GetLegalMoves(state);
                if (legal.Count == 0)
                {
                    Rules.PassTurn(state);
                    report.Passes++;
                    continue;
                }

                var result = Rules.ApplyMove(state, ChooseEliteMove(state, legal));
                foreach (var gameEvent in result.Events)
                {
                    if (gameEvent == "capture")
                    {
                        report.Captures++;
                    }
                    else if (gameEvent == "released_from_base")
                    {
                        report.Releases++;
                    }
                    else if (gameEvent == "home")
                    {
                        report.Homes++;
                    }
                }
            }

            report.Timeout = state.Phase != TurnRulesPhase.EndMatch;
            return report;
        }

        private static int ChooseEliteMove(TurnRulesState state, List<int> legal)
        {
            var bestToken = legal[0];
            var bestScore = int.MinValue;
            foreach (var tokenIndex in legal)
            {
                var score = ScoreMove(state, tokenIndex);
                if (score > bestScore)
                {
                    bestScore = score;
                    bestToken = tokenIndex;
                }
            }

            return bestToken;
        }

        private static int ScoreMove(TurnRulesState state, int tokenIndex)
        {
            var playerIndex = state.Turn;
            var token = state.Players[playerIndex].Tokens[tokenIndex];
            var score = 0;
            var targetSteps = 0;

            if (token.Steps == -1)
            {
                score += 180;
            }
            else
            {
                score += token.Steps;
                targetSteps = token.Steps + state.Dice;
            }

            if (targetSteps == TurnRulesEngine.FinishSteps)
            {
                score += 1200;
            }
            else if (targetSteps < TurnRulesEngine.TrackLength)
            {
                var position = Rules.BoardPosition(playerIndex, targetSteps);
                if (Rules.IsSafeSquare(position))
                {
                    score += 90;
                }
                else
                {
                    for (var otherIndex = 0; otherIndex < state.Players.Count; otherIndex++)
                    {
                        if (otherIndex == playerIndex)
                        {
                            continue;
                        }

                        foreach (var otherToken in state.Players[otherIndex].Tokens)
                        {
                            if (otherToken.Home || otherToken.Steps < 0 || otherToken.Steps >= TurnRulesEngine.TrackLength)
                            {
                                continue;
                            }

                            if (Rules.BoardPosition(otherIndex, otherToken.Steps) == position)
                            {
                                score += 420;
                            }
                        }
                    }
                }
            }

            return score;
        }

        private sealed class MatchReport
        {
            public int Turns;
            public int Captures;
            public int Releases;
            public int Homes;
            public int Passes;
            public bool Timeout;
        }
    }
}
`;
}

function renderAdvancedPlaytestScript(): string {
  return String.raw`using System;
using System.Collections.Generic;
using System.Globalization;
using GameOS.UnityAdapter;
using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine;

namespace GameOS.Editor
{
    public static class GameOsUnityAdvancedPlaytest
    {
        private static readonly TurnRulesEngine Rules = new TurnRulesEngine();
        private static readonly System.Random Rng = new System.Random(20260531);

        public static void Run()
        {
            try
            {
                var scene = EditorSceneManager.OpenScene("Assets/Scenes/Main.unity");
                var controller = UnityEngine.Object.FindAnyObjectByType<TurnRulesUnityController>();
                if (controller == null)
                {
                    throw new InvalidOperationException("TurnRulesUnityController missing from Main scene.");
                }

                var report = RunAdvancedPlayerSet();
                report.SceneLoaded = scene.IsValid();
                report.ControllerFound = true;
                report.WatermarkFound = controller.WatermarkText.Contains("GameOS");
                report.Verdict = report.SceneLoaded &&
                    report.ControllerFound &&
                    report.WatermarkFound &&
                    report.Timeouts == 0 &&
                    report.AverageTurns <= 260f &&
                    report.BranchingDecisions >= 20 &&
                    report.FinishChoices >= 8 &&
                    report.ReleaseChoices >= 20 &&
                    report.Passes > 0
                        ? "ADVANCED_PLAYER_APPROVED_UNITY_SLICE"
                        : "NEEDS_ARCHITECTURE_UPGRADE";

                Debug.Log("UNITY_ADVANCED_PLAYTEST_REPORT: " + report.ToJson());
                EditorApplication.Exit(report.Verdict == "ADVANCED_PLAYER_APPROVED_UNITY_SLICE" ? 0 : 2);
            }
            catch (Exception error)
            {
                Debug.LogError("UNITY_ADVANCED_PLAYTEST failed: " + error.Message);
                EditorApplication.Exit(1);
            }
        }

        private static AdvancedPlaytestReport RunAdvancedPlayerSet()
        {
            var report = new AdvancedPlaytestReport
            {
                Agent = "Advanced Player Council - Unity Engine Lane",
                Claim = "scene-aware capability engine playtest",
                Matches = 12
            };

            var totalTurns = 0;
            for (var matchIndex = 0; matchIndex < report.Matches; matchIndex++)
            {
                var match = PlayMatch();
                totalTurns += match.Turns;
                report.Captures += match.Captures;
                report.Releases += match.Releases;
                report.Homes += match.Homes;
                report.Passes += match.Passes;
                report.BranchingDecisions += match.BranchingDecisions;
                report.FinishChoices += match.FinishChoices;
                report.CaptureChoices += match.CaptureChoices;
                report.SafeChoices += match.SafeChoices;
                report.ReleaseChoices += match.ReleaseChoices;
                if (match.Timeout)
                {
                    report.Timeouts++;
                }
            }

            report.AverageTurns = (float)totalTurns / report.Matches;
            return report;
        }

        private static MatchReport PlayMatch()
        {
            var state = Rules.CreateInitialState(4, 2);
            var report = new MatchReport();

            while (state.Phase != TurnRulesPhase.EndMatch && report.Turns < 360)
            {
                report.Turns++;
                Rules.Roll(state, Rng.Next(1, 7));
                var legal = Rules.GetLegalMoves(state);
                if (legal.Count == 0)
                {
                    Rules.PassTurn(state);
                    report.Passes++;
                    continue;
                }

                if (legal.Count > 1)
                {
                    report.BranchingDecisions++;
                }

                var choice = ChooseAdvancedMove(state, legal, report);
                var result = Rules.ApplyMove(state, choice);
                foreach (var gameEvent in result.Events)
                {
                    if (gameEvent == "capture")
                    {
                        report.Captures++;
                    }
                    else if (gameEvent == "released_from_base")
                    {
                        report.Releases++;
                    }
                    else if (gameEvent == "home")
                    {
                        report.Homes++;
                    }
                }
            }

            report.Timeout = state.Phase != TurnRulesPhase.EndMatch;
            return report;
        }

        private static int ChooseAdvancedMove(TurnRulesState state, List<int> legal, MatchReport report)
        {
            var bestToken = legal[0];
            var bestScore = int.MinValue;
            var bestTag = "progress";

            foreach (var tokenIndex in legal)
            {
                var scored = ScoreMove(state, tokenIndex);
                if (scored.Score > bestScore)
                {
                    bestScore = scored.Score;
                    bestToken = tokenIndex;
                    bestTag = scored.Tag;
                }
            }

            if (bestTag == "finish")
            {
                report.FinishChoices++;
            }
            else if (bestTag == "capture")
            {
                report.CaptureChoices++;
            }
            else if (bestTag == "safe")
            {
                report.SafeChoices++;
            }
            else if (bestTag == "release")
            {
                report.ReleaseChoices++;
            }

            return bestToken;
        }

        private static ScoredMove ScoreMove(TurnRulesState state, int tokenIndex)
        {
            var playerIndex = state.Turn;
            var token = state.Players[playerIndex].Tokens[tokenIndex];
            var score = 0;
            var targetSteps = 0;
            var tag = "progress";

            if (token.Steps == -1)
            {
                score += 180;
                tag = "release";
            }
            else
            {
                score += token.Steps;
                targetSteps = token.Steps + state.Dice;
            }

            if (targetSteps == TurnRulesEngine.FinishSteps)
            {
                score += 1200;
                tag = "finish";
            }
            else if (targetSteps < TurnRulesEngine.TrackLength)
            {
                var position = Rules.BoardPosition(playerIndex, targetSteps);
                if (Rules.IsSafeSquare(position))
                {
                    score += 90;
                    if (tag == "progress")
                    {
                        tag = "safe";
                    }
                }
                else
                {
                    for (var otherIndex = 0; otherIndex < state.Players.Count; otherIndex++)
                    {
                        if (otherIndex == playerIndex)
                        {
                            continue;
                        }

                        foreach (var otherToken in state.Players[otherIndex].Tokens)
                        {
                            if (otherToken.Home || otherToken.Steps < 0 || otherToken.Steps >= TurnRulesEngine.TrackLength)
                            {
                                continue;
                            }

                            if (Rules.BoardPosition(otherIndex, otherToken.Steps) == position)
                            {
                                score += 420;
                                tag = "capture";
                            }
                        }
                    }
                }
            }

            return new ScoredMove { Score = score, Tag = tag };
        }

        private struct ScoredMove
        {
            public int Score;
            public string Tag;
        }

        private sealed class MatchReport
        {
            public int Turns;
            public int Captures;
            public int Releases;
            public int Homes;
            public int Passes;
            public int BranchingDecisions;
            public int FinishChoices;
            public int CaptureChoices;
            public int SafeChoices;
            public int ReleaseChoices;
            public bool Timeout;
        }

        private sealed class AdvancedPlaytestReport
        {
            public string Agent;
            public string Claim;
            public int Matches;
            public float AverageTurns;
            public int Captures;
            public int Releases;
            public int Homes;
            public int Passes;
            public int Timeouts;
            public int BranchingDecisions;
            public int FinishChoices;
            public int CaptureChoices;
            public int SafeChoices;
            public int ReleaseChoices;
            public bool SceneLoaded;
            public bool ControllerFound;
            public bool WatermarkFound;
            public string Verdict;

            public string ToJson()
            {
                return "{" +
                    "\"agent\":\"" + Agent + "\"," +
                    "\"claim\":\"" + Claim + "\"," +
                    "\"matches\":" + Matches + "," +
                    "\"average_turns\":" + AverageTurns.ToString("0.0", CultureInfo.InvariantCulture) + "," +
                    "\"captures\":" + Captures + "," +
                    "\"releases\":" + Releases + "," +
                    "\"homes\":" + Homes + "," +
                    "\"passes\":" + Passes + "," +
                    "\"timeouts\":" + Timeouts + "," +
                    "\"branching_decisions\":" + BranchingDecisions + "," +
                    "\"finish_choices\":" + FinishChoices + "," +
                    "\"capture_choices\":" + CaptureChoices + "," +
                    "\"safe_choices\":" + SafeChoices + "," +
                    "\"release_choices\":" + ReleaseChoices + "," +
                    "\"scene_loaded\":" + (SceneLoaded ? "true" : "false") + "," +
                    "\"controller_found\":" + (ControllerFound ? "true" : "false") + "," +
                    "\"watermark_found\":" + (WatermarkFound ? "true" : "false") + "," +
                    "\"verdict\":\"" + Verdict + "\"" +
                    "}";
            }
        }
    }
}
`;
}

function renderUnityBrief(workspace: ProjectWorkspace): string {
  const rules = workspace.artifacts.find((artifact) => artifact.kind === "rules-spec");
  const memory = workspace.artifacts.find((artifact) => artifact.kind === "memory-map");
  const capabilityMapArtifact = workspace.artifacts.find((artifact) => artifact.kind === "capability-map");
  const acceptanceProfileArtifact = workspace.artifacts.find((artifact) => artifact.kind === "acceptance-profile");
  const doctrine = engineDoctrine(workspace);

  return [
    `# ${workspace.project.name} Unity Engine Lane Brief`,
    "",
    "## Source",
    workspace.brief.summary,
    "",
    "## Core Loop",
    ...workspace.brief.coreLoop.map((step, index) => `${index + 1}. ${step}`),
    "",
    "## Adapter Inputs",
    `- Rules spec: ${rules ? toProjectRelativeArtifactPath(rules.path, workspace.project.id) : "missing"}`,
    `- Memory map: ${memory ? toProjectRelativeArtifactPath(memory.path, workspace.project.id) : "missing"}`,
    `- Capability map: ${capabilityMapArtifact ? toProjectRelativeArtifactPath(capabilityMapArtifact.path, workspace.project.id) : "missing"}`,
    `- Acceptance profile: ${acceptanceProfileArtifact ? toProjectRelativeArtifactPath(acceptanceProfileArtifact.path, workspace.project.id) : "missing"}`,
    `- Unity version: ${unityEditorVersion}`,
    `- Primary archetype: ${doctrine.primaryArchetype}`,
    `- Selected capabilities: ${doctrine.capabilityLabels.join(", ")}`,
    "- Watermark: Made with GameOS is required in runtime UI and manifest provenance.",
    "- Mode: local capability proof sprint, first two tokens home wins for a short engine-lane validation slice.",
    "- Target: local playable engine test lane, no store or platform publishing automation."
  ].join("\n");
}

function renderAdapterManifest(workspace: ProjectWorkspace): string {
  const doctrine = engineDoctrine(workspace);
  return `${JSON.stringify(
    {
      generatedBy: "Game OS",
      adapter: "unity",
      unityVersion: unityEditorVersion,
      projectId: workspace.project.id,
      projectName: workspace.project.name,
      genre: workspace.project.genre,
      targetPlatforms: workspace.project.targetPlatforms,
      capabilityMap: {
        required: true,
        primaryArchetype: doctrine.primaryArchetype,
        selectedCapabilities: doctrine.capabilityIds,
        selectedCapabilityLabels: doctrine.capabilityLabels
      },
      acceptanceProfile: {
        required: true,
        selectedCapabilities: doctrine.acceptanceProfile.selectedCapabilities,
        requiredPlayerActions: doctrine.acceptanceProfile.requiredPlayerActions,
        requiredVisualChecks: doctrine.acceptanceProfile.requiredVisualChecks,
        requiredInputChecks: doctrine.acceptanceProfile.requiredInputChecks,
        blockedPublishClaims: doctrine.acceptanceProfile.blockedPublishClaims
      },
      watermark: {
        required: true,
        label: "Made with GameOS",
        placement: "runtime-ui-bottom-right"
      },
      publishBoundary: "Local Unity engine test lane only. Store/platform publishing automation is outside this release.",
      scenes: ["Assets/Scenes/Main.unity"],
      scripts: [
        "Assets/Scripts/TurnRulesEngine.cs",
        "Assets/Scripts/TurnRulesUnityController.cs",
        "Assets/Editor/GameOsUnitySmoke.cs",
        "Assets/Editor/GameOsUnityPlayerAgent.cs",
        "Assets/Editor/GameOsUnityAdvancedPlaytest.cs"
      ],
      smokeCommand: "Unity -batchmode -nographics -quit -projectPath unity -executeMethod GameOS.Editor.GameOsUnitySmoke.Run -logFile -",
      playerAgentCommand: "Unity -batchmode -nographics -quit -projectPath unity -executeMethod GameOS.Editor.GameOsUnityPlayerAgent.Run -logFile -",
      advancedPlaytestCommand:
        "Unity -batchmode -nographics -quit -projectPath unity -executeMethod GameOS.Editor.GameOsUnityAdvancedPlaytest.Run -logFile -"
    },
    null,
    2
  )}\n`;
}

function renderUnityReport(workspace: ProjectWorkspace, projectRoot: string, files: string[]): string {
  const doctrine = engineDoctrine(workspace);
  return [
    `# ${workspace.project.name} Unity Engine Adapter`,
    "",
    "## Generated Project",
    `Path: ${projectRoot}`,
    "",
    "## Files",
    ...files.map((file) => `- ${path.relative(projectRoot, file)}`),
    "",
    "## How To Smoke Test",
    "```bash",
    `npm run unity:smoke -- ${projectRoot}`,
    "```",
    "",
    "## How To Launch The Player Agent",
    "```bash",
    `npm run unity:player -- ${projectRoot}`,
    "```",
    "",
    "## How To Run The Advanced Player Playtest",
    "```bash",
    `npm run unity:advanced -- ${projectRoot}`,
    "```",
    "",
    "## Capability And Acceptance",
    `- Primary archetype: ${doctrine.primaryArchetype}`,
    ...doctrine.capabilityLabels.map((label) => `- Capability: ${label}`),
    "- Acceptance profile: required before engine-lane QA is trusted.",
    "- Watermark/provenance: Made with GameOS required in runtime UI and adapter manifest.",
    "",
    "## Architect Notes",
    "- This is a local Unity capability engine lane, not publishing automation.",
    "- The playable mode is a short capability proof sprint; longer modes belong behind later quality gates.",
    "- The generated C# resolver is the source of truth for human moves, bot moves, QA simulation, save/resume, and replay validation.",
    "- The Unity editor batchmode smoke, player agent, and scene-aware advanced-player playtest must pass before this lane is promoted."
  ].join("\n");
}

function engineDoctrine(workspace: ProjectWorkspace) {
  const capabilityMap = createCapabilityMap(workspace.project, workspace.brief);
  const capabilityIds = capabilityMap.selectedCapabilities.map((capability) => capability.id);
  const acceptanceProfile = createAcceptanceProfile(workspace, capabilityIds);
  return {
    primaryArchetype: capabilityMap.primaryArchetype,
    capabilityIds,
    capabilityLabels: capabilityMap.selectedCapabilities.map((capability) => capability.label),
    acceptanceProfile
  };
}

function escapeCSharpString(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, " ");
}
