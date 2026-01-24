"use client";

import { DocSection, DocItem } from "@/lib/docs-content";

interface DocsSectionProps {
  section: DocSection;
}

function InfoBox({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="bg-gradient-to-r from-bags-green/10 to-bags-gold/10 border border-bags-green/30 p-3 my-3">
      <p className="font-pixel text-[10px] text-bags-gold mb-2">{title}</p>
      <ul className="space-y-1">
        {items.map((item, i) => (
          <li key={i} className="flex items-start gap-2">
            <span className="font-pixel text-bags-green text-[8px]">*</span>
            <span className="font-pixel text-[8px] text-gray-300">{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function DataTable({ headers, rows }: { headers: string[]; rows: string[][] }) {
  return (
    <div className="overflow-x-auto my-3">
      <table className="w-full border-2 border-bags-green/50">
        <thead>
          <tr className="bg-bags-green/10">
            {headers.map((header, i) => (
              <th
                key={i}
                className="font-pixel text-[8px] text-bags-gold p-2 text-left border-b border-bags-green/30"
              >
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className={i % 2 === 0 ? "bg-bags-darker/50" : "bg-bags-dark"}>
              {row.map((cell, j) => (
                <td
                  key={j}
                  className="font-pixel text-[8px] text-gray-300 p-2 border-b border-bags-green/20"
                >
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function CodeBlock({ title, code }: { title: string; code: string }) {
  return (
    <div className="my-3">
      <p className="font-pixel text-[8px] text-bags-gold mb-1">{title}</p>
      <pre className="bg-bags-darker border border-bags-green/30 p-3 overflow-x-auto">
        <code className="font-mono text-[9px] text-bags-green whitespace-pre">{code}</code>
      </pre>
    </div>
  );
}

function Steps({ steps }: { steps: { number: number; title: string; description: string }[] }) {
  return (
    <div className="space-y-3 my-3">
      {steps.map((step) => (
        <div
          key={step.number}
          className="flex gap-3 bg-bags-darker/50 p-3 border-l-4 border-bags-green"
        >
          <div className="flex-shrink-0 w-6 h-6 bg-bags-green flex items-center justify-center">
            <span className="font-pixel text-[10px] text-bags-dark font-bold">{step.number}</span>
          </div>
          <div>
            <p className="font-pixel text-[10px] text-bags-gold mb-1">{step.title}</p>
            <p className="font-pixel text-[8px] text-gray-300">{step.description}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

function Tips({ tips }: { tips: string[] }) {
  return (
    <div className="bg-bags-gold/10 border border-bags-gold/30 p-3 my-3">
      <p className="font-pixel text-[10px] text-bags-gold mb-2">PRO TIPS</p>
      <ul className="space-y-1">
        {tips.map((tip, i) => (
          <li key={i} className="flex items-start gap-2">
            <span className="font-pixel text-bags-gold text-[8px]">-&gt;</span>
            <span className="font-pixel text-[8px] text-gray-300">{tip}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function DocItemContent({ item }: { item: DocItem }) {
  return (
    <div id={item.id} className="scroll-mt-20">
      <h3 className="font-pixel text-xs text-bags-gold mb-2 border-b border-bags-green/30 pb-2">
        {item.title}
      </h3>
      <div className="space-y-2">
        {item.content.map((paragraph, i) => (
          <p key={i} className="font-pixel text-[9px] text-gray-300 leading-relaxed">
            {paragraph}
          </p>
        ))}
      </div>
      {item.infoBox && <InfoBox {...item.infoBox} />}
      {item.steps && <Steps steps={item.steps} />}
      {item.table && <DataTable {...item.table} />}
      {item.codeBlock && <CodeBlock {...item.codeBlock} />}
      {item.tips && <Tips tips={item.tips} />}
    </div>
  );
}

export function DocsSection({ section }: DocsSectionProps) {
  return (
    <section id={section.id} className="scroll-mt-20 mb-8">
      <h2 className="font-pixel text-sm text-bags-green mb-4 border-b-2 border-bags-green pb-2">
        {section.title}
      </h2>
      <div className="space-y-6">
        {section.items.map((item) => (
          <DocItemContent key={item.id} item={item} />
        ))}
      </div>
    </section>
  );
}
