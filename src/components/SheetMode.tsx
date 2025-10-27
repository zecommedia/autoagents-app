import React, { useState, useRef, useCallback } from "react";
import ChatPanel from "./ChatPanel";
import type { ChatMessage } from "../App";
import {
    Panel,
    PanelGroup,
    PanelResizeHandle,
} from "react-resizable-panels";
import { HotTable } from '@handsontable/react';
import { registerAllModules } from 'handsontable/registry';
import 'handsontable/dist/handsontable.full.css';
import { Bold, Italic, PaintBucket, Type } from 'lucide-react';

// Register Handsontable modules
registerAllModules();

interface SheetModeProps {
    history: ChatMessage[];
    onSendMessage: (
        message: string,
        images: { data: string; mimeType: string }[],
        provider: 'gemini' | 'openai'
    ) => void;
    isGenerating: boolean;
    onImageClick: (src: string) => void;
    onRerunMessage: (index: number) => void;
    onEditMessage: (index: number) => void;
    editingMessage: ChatMessage | null;
    onCancelEdit: () => void;
    onDeleteMessage: (index: number) => void;
    sheetOnLeft?: boolean;
}

const initialSheets = {
    "Research Keyword": [
        ["Google Trends", "life of a showgirl track 9", "Từ khóa \"life of a showgirl track 9\" trở nên hot trong 24h qua do một nghệ sĩ nổi tiếng đi đã phân tích", "duyệt", "", ""],
        ["Google Trends", "bill croskey merritt shirt", "", "", "", ""],
        ["Google Trends", "only christopher we acknowledge is walla", "", "", "", ""],
        ["Google Trends", "rod wave shirt", "", "", "", ""],
        ["Google Trends", "bill croskey merritt", "", "", "", ""],
        ["Google Trends", "big dumper shirt", "", "", "", ""],
        ["Trends24h", "Columbus", "", "", "", ""],
        ["Trends24h", "#WERaw", "", "", "", ""],
        ["Trends24h", "#IndigenousPeoplesDay", "", "", "", ""],
        ["Trends24h", "Middle East", "", "", "", ""],
        ["Trends24h", "Seth", "", "", "", ""],
        ["Trends24h", "SBU", "", "", "", ""],
        ["Trends24h", "#IDontWantToOverreactBUT", "", "", "", ""],
        ["Trends24h", "Darius Smith", "", "", "", ""],
        ["Trends24h", "Marc", "", "", "", ""],
        ["Trends24h", "Thanksgiving", "", "", "", ""],
        ["Google Trends", "swiftday: (13/10/2025, 11:34 - 14/10/202)", "", "duyệt", "", ""],
    ],
    "Research Idea": [
        ["Idea 1", "Description for idea 1"],
        ["Idea 2", "Description for idea 2"],
    ],
    "Design": [
        ["Design Concept A", "In progress"],
    ],
    "Mockup": [
        ["Mockup v1", "Approved"],
    ]
};

const columnHeaders = [
    "Nền tảng",
    "Keyword / Hashtag",
    "Phân tích",
    "Trạng thái",
    "Check tiềm năng",
    "Phrase KW",
];

const getRowColor = (platform: string) => {
    if (platform === "Google Trends") {
        return "bg-red-500/10";
    }
    if (platform === "Trends24h") {
        return "bg-yellow-500/10";
    }
    return "bg-zinc-900";
};

const FormattingToolbar: React.FC<{ hotInstance: HotTable['hotInstance'] | null }> = ({ hotInstance }) => {
    const applyStyle = (style: string, value: any) => {
        if (!hotInstance) return;
        const selected = hotInstance.getSelected();
        if (!selected) return;

        selected.forEach(([startRow, startCol, endRow, endCol]) => {
            for (let r = startRow; r <= endRow; r++) {
                for (let c = startCol; c <= endCol; c++) {
                    const currentClassName = hotInstance.getCellMeta(r, c).className || '';
                    let newClassName = currentClassName;

                    if (style === 'bold') {
                        newClassName = newClassName.includes('font-bold') ? newClassName.replace('font-bold', '') : `${newClassName} font-bold`;
                    } else if (style === 'italic') {
                         newClassName = newClassName.includes('italic') ? newClassName.replace('italic', '') : `${newClassName} italic`;
                    } else if (style === 'color') {
                        // Remove other color classes
                        newClassName = newClassName.replace(/text-\S+/g, '');
                        newClassName = `${newClassName} ${value}`;
                    } else if (style === 'bgColor') {
                        // Remove other bg color classes
                        newClassName = newClassName.replace(/bg-\S+/g, '');
                        newClassName = `${newClassName} ${value}`;
                    }
                    
                    hotInstance.setCellMeta(r, c, 'className', newClassName.trim());
                }
            }
        });
        hotInstance.render();
    };
    
    const colors = ['text-white', 'text-red-400', 'text-yellow-400', 'text-green-400', 'text-blue-400'];
    const bgColors = ['bg-transparent', 'bg-red-500/20', 'bg-yellow-500/20', 'bg-green-500/20', 'bg-blue-500/20'];

    return (
        <div className="p-1 flex items-center space-x-2 border-b border-zinc-700 bg-zinc-800">
            <button onClick={() => applyStyle('bold', true)} className="p-2 hover:bg-zinc-700 rounded-md"><Bold className="w-4 h-4" /></button>
            <button onClick={() => applyStyle('italic', true)} className="p-2 hover:bg-zinc-700 rounded-md"><Italic className="w-4 h-4" /></button>
            
            <div className="h-6 border-l border-zinc-600 mx-2"></div>

            <PaintBucket className="w-4 h-4 text-zinc-400" />
            {bgColors.map(color => (
                <button key={color} onClick={() => applyStyle('bgColor', color)} className={`w-6 h-6 rounded ${color === 'bg-transparent' ? 'border border-zinc-500' : color}`}></button>
            ))}

            <div className="h-6 border-l border-zinc-600 mx-2"></div>
            
            <Type className="w-4 h-4 text-zinc-400" />
            {colors.map(color => (
                <button key={color} onClick={() => applyStyle('color', color)} className={`w-6 h-6 rounded ${color}`}>{color === 'text-white' ? 'A' : 'A'}</button>
            ))}
        </div>
    );
};


const SheetMode: React.FC<SheetModeProps> = ({
    history,
    onSendMessage,
    isGenerating,
    onImageClick,
    onRerunMessage,
    onEditMessage,
    editingMessage,
    onCancelEdit,
    onDeleteMessage,
    sheetOnLeft = true,
}) => {
    const [sheets, setSheets] = useState(initialSheets);
    const [activeTab, setActiveTab] = useState(Object.keys(initialSheets)[0]);
    const [rowsToAdd, setRowsToAdd] = useState(1000);
    const hotTableRef = useRef<HotTable>(null);

    const onTabClick = (tabName: string) => {
        setActiveTab(tabName);
    };

    const addRows = () => {
        const hot = hotTableRef.current?.hotInstance;
        if (hot) {
            const currentData = sheets[activeTab];
            const newRows = Array.from({ length: rowsToAdd }, () => Array(columnHeaders.length).fill(''));
            const newData = [...currentData, ...newRows];
            setSheets(prev => ({...prev, [activeTab]: newData}));
        }
    };

    const sheetPanel = (
        <Panel defaultSize={75} minSize={30}>
            <div className="w-full h-full bg-zinc-900 flex flex-col">
                <FormattingToolbar hotInstance={hotTableRef.current?.hotInstance || null} />
                <div className="flex-grow relative">
                    <div className="absolute inset-0">
                        <HotTable
                            ref={hotTableRef}
                            data={sheets[activeTab]}
                            colHeaders={columnHeaders}
                            rowHeaders={true}
                            width="100%"
                            height="100%"
                            manualColumnResize={true}
                            manualRowResize={true}
                            contextMenu={true}
                            dropdownMenu={true}
                            filters={true}
                            columnSorting={true}
                            className="htDark"
                            licenseKey="non-commercial-and-evaluation"
                            columns={(colIndex) => {
                                if (colIndex === 0) {
                                    return {
                                        type: 'dropdown',
                                        source: ['Google Trends', 'Trends24h']
                                    };
                                }
                                if (colIndex === 3) {
                                    return {
                                        type: 'dropdown',
                                        source: ['duyệt', 'chờ', 'từ chối']
                                    };
                                }
                                return {};
                            }}
                            cells={(row, col, prop) => {
                                const cellProperties: any = {};
                                const platform = hotTableRef.current?.hotInstance.getDataAtCell(row, 0);
                                if (platform === 'Google Trends') {
                                    cellProperties.className = 'bg-red-500/10';
                                } else if (platform === 'Trends24h') {
                                    cellProperties.className = 'bg-yellow-500/10';
                                }
                                
                                const status = hotTableRef.current?.hotInstance.getDataAtCell(row, 3);
                                 if (status === 'duyệt') {
                                    cellProperties.className = (cellProperties.className || '') + ' bg-green-500/20';
                                }

                                return cellProperties;
                            }}
                        />
                    </div>
                </div>
                <div className="flex-shrink-0 h-10 bg-zinc-900 border-t border-zinc-700 flex items-center px-2">
                    {Object.keys(sheets).map(tab => (
                        <button
                            key={tab}
                            onClick={() => onTabClick(tab)}
                            className={`px-4 py-2 text-sm border-b-2 ${activeTab === tab ? 'border-green-500 text-white' : 'border-transparent text-zinc-400 hover:bg-zinc-800'}`}
                        >
                            {tab}
                        </button>
                    ))}
                     <div className="flex-grow"></div>
                     <div className="flex items-center space-x-2">
                        <button onClick={addRows} className="text-sm text-blue-400 hover:underline">Thêm</button>
                        <input 
                            type="number" 
                            value={rowsToAdd} 
                            onChange={(e) => setRowsToAdd(parseInt(e.target.value, 10))}
                            className="w-20 bg-zinc-800 border border-zinc-700 rounded-md px-2 py-1 text-sm"
                        />
                        <span className="text-sm text-zinc-400">hàng khác ở dưới cùng</span>
                    </div>
                </div>
            </div>
        </Panel>
    );

    const chatPanel = (
        <Panel defaultSize={25} minSize={20}>
            <div className="w-full h-full">
                <ChatPanel
                    history={history}
                    onSendMessage={onSendMessage}
                    isGenerating={isGenerating}
                    onImageClick={onImageClick}
                    onRerunMessage={onRerunMessage}
                    onEditMessage={onEditMessage}
                    editingMessage={editingMessage}
                    onCancelEdit={onCancelEdit}
                    onDeleteMessage={onDeleteMessage}
                />
            </div>
        </Panel>
    );

    return (
        <PanelGroup direction="horizontal" className="w-full h-full">
            {sheetOnLeft ? sheetPanel : chatPanel}
            <PanelResizeHandle className="w-1.5 bg-zinc-800 hover:bg-zinc-700 transition-colors" />
            {sheetOnLeft ? chatPanel : sheetPanel}
        </PanelGroup>
    );
};

export default SheetMode;
