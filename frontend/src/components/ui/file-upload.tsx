import { useRef, useState } from "react";
import { motion } from "motion/react";
import { IconUpload } from "@tabler/icons-react";
import { useDropzone } from "react-dropzone";
import { cn } from "@/lib/utils";

const mainVariant = {
    initial: {
        x: 0,
        y: 0,
    },
    animate: {
        x: 20,
        y: -20,
        opacity: 0.9,
    },
};

const secondaryVariant = {
    initial: {
        opacity: 0,
    },
    animate: {
        opacity: 1,
    },
};

export const FileUpload = ({
    onChange,
    accept,
    id = "file-upload",
}: {
    onChange?: (files: File[]) => void;
    accept?: Record<string, string[]>;
    id?: string;
}) => {
    const [files, setFiles] = useState<File[]>([]);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileChange = (newFiles: File[]) => {
        setFiles((prevFiles) => [...prevFiles, ...newFiles]);
        onChange && onChange(newFiles);
    };

    const onDrop = (acceptedFiles: File[]) => {
        handleFileChange(acceptedFiles);
    };

    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        multiple: false,
        noClick: true,
        onDrop,
        onDropRejected: (error) => {
            console.log(error);
        },
        accept,
    });

    return (
        <div className="w-full" {...getRootProps()}>
            <motion.div
                onClick={() => fileInputRef.current?.click()}
                whileHover="animate"
                className="group/file block cursor-pointer w-full relative overflow-hidden rounded-sm"
            >
                <input
                    {...getInputProps()}
                    ref={fileInputRef}
                    id={id + "-handle"}
                    className="hidden"
                />
                <div className="relative w-full mx-auto">
                    {files.length > 0 &&
                        files.map((file, idx) => (
                            <motion.div
                                key={"file" + idx}
                                layoutId={idx === 0 ? id : id + "-" + idx}
                                className={cn(
                                    "relative overflow-hidden z-40 bg-background border border-border flex flex-col items-start justify-start md:h-24 p-4 mb-4 w-full mx-auto rounded-md shadow-sm",
                                    "shadow-[0px_10px_50px_rgba(0,0,0,0.1)]"
                                )}
                            >
                                <div className="flex justify-between w-full items-center gap-4">
                                    <motion.p
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        layout
                                        className="text-base text-foreground truncate max-w-xs"
                                    >
                                        {file.name}
                                    </motion.p>
                                    <motion.p
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        layout
                                        className="rounded-lg px-2 py-1 w-fit shrink-0 text-sm text-muted-foreground shadow-input"
                                    >
                                        {(file.size / (1024 * 1024)).toFixed(2)} MB
                                    </motion.p>
                                </div>
                                <div className="flex text-sm md:flex-row flex-col items-start md:items-center w-full mt-2 justify-between text-muted-foreground">
                                    <motion.p
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        layout
                                        className="px-1 py-0.5 rounded-md bg-card "
                                    >
                                        {file.type}
                                    </motion.p>
                                    <motion.p
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        layout
                                    >
                                        modified {new Date(file.lastModified).toLocaleDateString()}
                                    </motion.p>
                                </div>
                            </motion.div>
                        ))}
                    {!files.length && (
                        <motion.div
                            layoutId={id}
                            variants={mainVariant}
                            transition={{
                                type: "spring",
                                stiffness: 300,
                                damping: 20,
                            }}
                            className={cn(
                                "relative group-hover/file:shadow-2xl z-40 bg-background border border-border flex items-center justify-center h-24 w-full mx-auto rounded-md",
                                "shadow-[0px_10px_50px_rgba(0,0,0,0.1)]"
                            )}
                        >
                            {isDragActive ? (
                                <motion.p
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    className="text-muted-foreground flex flex-col items-center"
                                >
                                    Drop it
                                    <IconUpload className="h-4 w-4 text-muted-foreground" />
                                </motion.p>
                            ) : (
                                <IconUpload className="h-4 w-4 text-foreground" />
                            )}
                        </motion.div>
                    )}
                    {!files.length && (
                        <motion.div
                            variants={secondaryVariant}
                            className="absolute opacity-0 border border-dashed border-sky-400 inset-0 z-30 bg-transparent flex items-center justify-center h-24 w-full mx-auto rounded-md"
                        ></motion.div>
                    )}
                </div>
            </motion.div>
        </div>
    );
};
