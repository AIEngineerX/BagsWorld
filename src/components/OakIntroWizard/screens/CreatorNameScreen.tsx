"use client";

import React, { useState, useEffect, useCallback } from "react";
import type { ScreenProps } from "../types";

const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
const MAX_NAME_LENGTH = 10;

export function CreatorNameScreen({ state, dispatch, onAdvance }: ScreenProps) {
  const [name, setName] = useState(state.creatorName || "");
  const [cursorVisible, setCursorVisible] = useState(true);

  // Blinking cursor
  useEffect(() => {
    const interval = setInterval(() => {
      setCursorVisible((v) => !v);
    }, 500);
    return () => clearInterval(interval);
  }, []);

  const addLetter = useCallback(
    (letter: string) => {
      if (name.length < MAX_NAME_LENGTH) {
        const newName = name + letter;
        setName(newName);
        dispatch({ type: "SET_CREATOR_NAME", name: newName });
      }
    },
    [name, dispatch]
  );

  const deleteLetter = useCallback(() => {
    if (name.length > 0) {
      const newName = name.slice(0, -1);
      setName(newName);
      dispatch({ type: "SET_CREATOR_NAME", name: newName });
    }
  }, [name, dispatch]);

  const confirm = useCallback(() => {
    if (name.length >= 1) {
      dispatch({ type: "SET_CREATOR_NAME", name });
      onAdvance();
    }
  }, [name, dispatch, onAdvance]);

  // Keyboard input
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      e.stopPropagation();
      const key = e.key.toUpperCase();
      if (key.length === 1 && key >= "A" && key <= "Z") {
        e.preventDefault();
        addLetter(key);
      } else if (e.code === "Backspace") {
        e.preventDefault();
        deleteLetter();
      } else if (e.code === "Enter" && name.length >= 1) {
        e.preventDefault();
        confirm();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [addLetter, deleteLetter, confirm, name.length]);

  return (
    <div
      className="absolute inset-0 bg-black flex flex-col items-center justify-center px-4"
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => e.stopPropagation()}
      role="presentation"
    >
      {/* Title */}
      <h2 className="font-pixel text-[11px] sm:text-sm text-white mb-4">What is your name?</h2>

      {/* Name display */}
      <div className="mb-6 min-h-[28px] flex items-center justify-center">
        <span className="font-pixel text-lg text-bags-green tracking-wider">
          {name}
          <span
            className="inline-block w-[2px] ml-[1px]"
            style={{
              opacity: cursorVisible ? 1 : 0,
              backgroundColor: "#22C55E",
              height: "1em",
              verticalAlign: "text-bottom",
            }}
          >
            &nbsp;
          </span>
        </span>
      </div>

      {/* Character grid */}
      <div className="grid grid-cols-6 gap-1 mb-4 max-w-[280px]">
        {LETTERS.map((letter) => (
          <button
            key={letter}
            type="button"
            className="w-10 h-10 flex items-center justify-center font-pixel text-sm text-white bg-gray-800 hover:bg-gray-700 active:bg-bags-green active:text-black border border-gray-600 hover:border-gray-400 cursor-pointer transition-colors duration-100"
            onClick={() => addLetter(letter)}
          >
            {letter}
          </button>
        ))}

        {/* DEL button */}
        <button
          type="button"
          className="w-10 h-10 flex items-center justify-center font-pixel text-[9px] text-red-400 bg-gray-800 hover:bg-gray-700 active:bg-red-600 active:text-white border border-gray-600 hover:border-red-400 cursor-pointer transition-colors duration-100 col-span-2"
          onClick={deleteLetter}
        >
          DEL
        </button>

        {/* OK button */}
        <button
          type="button"
          className={`w-10 h-10 flex items-center justify-center font-pixel text-[9px] border cursor-pointer transition-colors duration-100 col-span-2 ${name.length >= 1 ? "text-bags-green bg-gray-800 hover:bg-bags-green hover:text-black border-bags-green" : "text-gray-600 bg-gray-900 border-gray-700 cursor-not-allowed"}`}
          onClick={confirm}
          disabled={name.length < 1}
        >
          OK
        </button>
      </div>

      {/* Hint */}
      <p className="font-pixel text-[8px] text-gray-600">
        A-Z keys or tap letters ({name.length}/{MAX_NAME_LENGTH})
      </p>
    </div>
  );
}
