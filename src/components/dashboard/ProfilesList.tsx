'use client';

import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";

interface Profile {
    id: string;
    date: Date;
    status: string;
    data: {
        fullName?: string;
        name?: string;          // alternative field name
        email?: string;
        phone?: string;
        currentRole?: string;
        role?: string;          // alternative field name
        company?: string;
        location?: string;
        budget?: string;
        availability?: string;
        alignmentScore?: number;
        cultureFitScore?: number; // legacy
        summaryNote?: string;
        recruiterNote?: string; // legacy
        linkedIn?: string;
        portfolio?: string;
        userMessage?: string;
    };
}

export default function ProfilesList({ profiles }: { profiles: Profile[] }) {
    const escapeCsv = (value: unknown): string => {
        const text = String(value ?? '');
        if (/[",\n\r]/.test(text)) {
            return `"${text.replace(/"/g, '""')}"`;
        }
        return text;
    };

    const downloadCSV = () => {
        const headers = [
            "Conversation ID",
            "Date",
            "Status",
            "Name",
            "Email",
            "Phone",
            "Role",
            "Company",
            "Location",
            "LinkedIn",
            "Portfolio",
            "Availability",
            "Budget",
            "Score",
            "Summary",
            "User Message"
        ];
        const rows = profiles.map(p => [
            p.id,
            new Date(p.date).toLocaleDateString(),
            p.status || "",
            p.data.fullName || p.data.name || "Anon",
            p.data.email || "",
            p.data.phone || "",
            p.data.currentRole || p.data.role || "",
            p.data.company || "",
            p.data.location || "",
            p.data.linkedIn || "",
            p.data.portfolio || "",
            p.data.availability || "",
            p.data.budget || "",
            p.data.alignmentScore || p.data.cultureFitScore || "",
            p.data.summaryNote || p.data.recruiterNote || "",
            p.data.userMessage || ""
        ]);

        const csvContent = [
            headers.map(escapeCsv).join(","),
            ...rows.map(row => row.map(escapeCsv).join(","))
        ].join("\n");

        const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", `profiles_export_${new Date().toISOString().split('T')[0]}.csv`);
        document.body.appendChild(link);
        link.click();
    };

    if (profiles.length === 0) {
        return (
            <Card className="p-12 text-center text-gray-500">
                <p>Nessun profilo raccolto finora.</p>
            </Card>
        );
    }

    return (
        <Card className="p-6">
            <div className="flex justify-end mb-4">
                <Button onClick={downloadCSV} variant="outline" className="gap-2">
                    <Download className="w-4 h-4" />
                    Esporta CSV
                </Button>
            </div>
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Data</TableHead>
                        <TableHead>Nome</TableHead>
                        <TableHead>Contatti</TableHead>
                        <TableHead>Ruolo/Azienda</TableHead>
                        <TableHead>Score</TableHead>
                        <TableHead>Note</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {profiles.map((profile) => (
                        <TableRow key={profile.id}>
                            <TableCell className="whitespace-nowrap">
                                {new Date(profile.date).toLocaleDateString()}
                            </TableCell>
                            <TableCell className="font-medium">
                                {profile.data.fullName || profile.data.name || "Anonimo"}
                            </TableCell>
                            <TableCell>
                                <div className="text-sm">
                                    {profile.data.email && <div>{profile.data.email}</div>}
                                    {profile.data.phone && <div className="text-gray-500">{profile.data.phone}</div>}
                                    {profile.data.linkedIn && (
                                        <a href={profile.data.linkedIn} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline text-xs">
                                            LinkedIn
                                        </a>
                                    )}
                                </div>
                            </TableCell>
                            <TableCell>
                                <div className="text-sm">
                                    {(profile.data.currentRole || profile.data.role) && <div className="font-medium">{profile.data.currentRole || profile.data.role}</div>}
                                    {profile.data.company && <div className="text-gray-500">{profile.data.company}</div>}
                                </div>
                            </TableCell>
                            <TableCell>
                                {(profile.data.alignmentScore || profile.data.cultureFitScore) && (
                                    <Badge variant={
                                        (profile.data.alignmentScore || profile.data.cultureFitScore || 0) >= 8 ? "default" :
                                            (profile.data.alignmentScore || profile.data.cultureFitScore || 0) >= 6 ? "secondary" : "destructive"
                                    }>
                                        {profile.data.alignmentScore || profile.data.cultureFitScore}/10
                                    </Badge>
                                )}
                            </TableCell>
                            <TableCell className="max-w-xs truncate text-sm text-gray-500" title={profile.data.summaryNote || profile.data.recruiterNote}>
                                {profile.data.summaryNote || profile.data.recruiterNote || "-"}
                            </TableCell>
                            <TableCell>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => window.location.href = `${profile.id}`}
                                >
                                    Dettagli
                                </Button>
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </Card>
    );
}
