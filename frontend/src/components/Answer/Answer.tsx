import { FormEvent, useEffect, useMemo, useState, useContext } from "react";
import { useBoolean } from "@fluentui/react-hooks"
import { Checkbox, DefaultButton, Dialog, FontIcon, Stack, Text, Rating } from "@fluentui/react";
import DOMPurify from 'dompurify';
import { AppStateContext } from '../../state/AppProvider';

import styles from "./Answer.module.css";

import { AskResponse, Citation, Feedback, historyMessageFeedback } from "../../api";
import { parseAnswer } from "./AnswerParser";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import supersub from 'remark-supersub'
import { ThumbDislike20Filled, ThumbLike20Filled } from "@fluentui/react-icons";
import { XSSAllowTags } from "../../constants/xssAllowTags";
import { isUndefined } from "lodash";

interface Props {
    answer: AskResponse;
    onCitationClicked: (citedDocument: Citation) => void;
}

export const Answer = ({
    answer,
    onCitationClicked
}: Props) => {

    const [isRefAccordionOpen, { toggle: toggleIsRefAccordionOpen }] = useBoolean(false);
    const filePathTruncationLimit = 50;

    const parsedAnswer = useMemo(() => parseAnswer(answer), [answer]);
    const [chevronIsExpanded, setChevronIsExpanded] = useState(isRefAccordionOpen);
    const [isFeedbackDialogOpen, setIsFeedbackDialogOpen] = useState(false);
    const [showReportInappropriateFeedback, setShowReportInappropriateFeedback] = useState(false);
    const [negativeFeedbackList, setNegativeFeedbackList] = useState<Feedback[]>([]);
    const [additionalComment, setAdditionalComment] = useState("");
    const [rating, setRating] = useState<number | undefined>(undefined);
    const appStateContext = useContext(AppStateContext)
    const FEEDBACK_ENABLED = appStateContext?.state.frontendSettings?.feedback_enabled && appStateContext?.state.isCosmosDBAvailable?.cosmosDB;

    const handleChevronClick = () => {
        setChevronIsExpanded(!chevronIsExpanded);
        toggleIsRefAccordionOpen();
    };

    useEffect(() => {
        setChevronIsExpanded(isRefAccordionOpen);
    }, [isRefAccordionOpen]);

    const createCitationFilepath = (citation: Citation, index: number, truncate: boolean = false) => {
        let citationFilename = "";

        if (citation.filepath) {
            const part_i = citation.part_index ?? (citation.chunk_id ? parseInt(citation.chunk_id) + 1 : '');
            if (truncate && citation.filepath.length > filePathTruncationLimit) {
                const citationLength = citation.filepath.length;
                citationFilename = `${citation.filepath.substring(0, 20)}...${citation.filepath.substring(citationLength - 20)} - Part ${part_i}`;
            }
            else {
                citationFilename = `${citation.filepath} - Part ${part_i}`;
            }
        }
        else if (citation.filepath && citation.reindex_id) {
            citationFilename = `${citation.filepath} - Part ${citation.reindex_id}`;
        }
        else {
            citationFilename = `Citation ${index}`;
        }
        return citationFilename;
    }

    const onFeedbackClicked = async () => {
        if (answer.message_id == undefined) return;

        // let newFeedbackState = feedbackState;
        setIsFeedbackDialogOpen(true);
        // appStateContext?.dispatch({ type: 'SET_FEEDBACK_STATE', payload: { answerId: answer.message_id, feedback: newFeedbackState } });
    }

    const updateFeedbackList = (ev?: FormEvent<HTMLElement | HTMLInputElement>, checked?: boolean) => {
        if (answer.message_id == undefined) return;
        let selectedFeedback = (ev?.target as HTMLInputElement)?.id as Feedback;

        let feedbackList = negativeFeedbackList.slice();
        if (checked) {
            feedbackList.push(selectedFeedback);
        } else {
            feedbackList = feedbackList.filter((f) => f !== selectedFeedback);
        }

        setNegativeFeedbackList(feedbackList);
    };

    const handleAdditionalCommentChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
        setAdditionalComment(event.target.value);
    };

    const handleRatingChange = (event: React.SyntheticEvent<HTMLElement>, newValue?: number) => {
        if (newValue !== undefined) {
            setRating(newValue);
        }
    };

    const getFeedbackType = () => {
        if (rating !== undefined) {
            if (rating < 3) {
                return 'negative';
            } else if (rating === 3) {
                return 'neutral';
            } else {
                return 'positive';
            }
        }
        return '';
    };

    const onSubmitFeedback = async () => {
        if (answer.message_id == undefined) return;

        // Include additional comments in the feedback payload
        await historyMessageFeedback(answer.message_id, rating,
            getFeedbackType() + ": " + negativeFeedbackList.join(","), additionalComment);
        resetFeedbackDialog();
    };

    const resetFeedbackDialog = () => {
        setIsFeedbackDialogOpen(false);
        setShowReportInappropriateFeedback(false);
        setNegativeFeedbackList([]);
    }

    const UnhelpfulFeedbackContent = () => {
        return (<>
            <div>Why wasn't this response helpful?</div>
            <Stack tokens={{ childrenGap: 4 }}>
                <Checkbox label="Citations are missing" id={Feedback.MissingCitation} defaultChecked={negativeFeedbackList.includes(Feedback.MissingCitation)} onChange={updateFeedbackList}></Checkbox>
                <Checkbox label="Citations are wrong" id={Feedback.WrongCitation} defaultChecked={negativeFeedbackList.includes(Feedback.WrongCitation)} onChange={updateFeedbackList}></Checkbox>
                <Checkbox label="The response is not from my data" id={Feedback.OutOfScope} defaultChecked={negativeFeedbackList.includes(Feedback.OutOfScope)} onChange={updateFeedbackList}></Checkbox>
                <Checkbox label="Inaccurate or irrelevant" id={Feedback.InaccurateOrIrrelevant} defaultChecked={negativeFeedbackList.includes(Feedback.InaccurateOrIrrelevant)} onChange={updateFeedbackList}></Checkbox>
                <Checkbox label="Other" id={Feedback.OtherUnhelpful} defaultChecked={negativeFeedbackList.includes(Feedback.OtherUnhelpful)} onChange={updateFeedbackList}></Checkbox>
            </Stack>
            <div onClick={() => setShowReportInappropriateFeedback(true)} style={{ color: "#115EA3", cursor: "pointer" }}>Report inappropriate content</div>
        </>);
    }

    const ReportInappropriateFeedbackContent = () => {
        return (
            <>
                <div>The content is <span style={{ color: "red" }} >*</span></div>
                <Stack tokens={{ childrenGap: 4 }}>
                    <Checkbox label="Hate speech, stereotyping, demeaning" id={Feedback.HateSpeech} defaultChecked={negativeFeedbackList.includes(Feedback.HateSpeech)} onChange={updateFeedbackList}></Checkbox>
                    <Checkbox label="Violent: glorification of violence, self-harm" id={Feedback.Violent} defaultChecked={negativeFeedbackList.includes(Feedback.Violent)} onChange={updateFeedbackList}></Checkbox>
                    <Checkbox label="Sexual: explicit content, grooming" id={Feedback.Sexual} defaultChecked={negativeFeedbackList.includes(Feedback.Sexual)} onChange={updateFeedbackList}></Checkbox>
                    <Checkbox label="Manipulative: devious, emotional, pushy, bullying" defaultChecked={negativeFeedbackList.includes(Feedback.Manipulative)} id={Feedback.Manipulative} onChange={updateFeedbackList}></Checkbox>
                    <Checkbox label="Other" id={Feedback.OtherHarmful} defaultChecked={negativeFeedbackList.includes(Feedback.OtherHarmful)} onChange={updateFeedbackList}></Checkbox>
                </Stack>
            </>
        );
    }

    return (
        <>
            <Stack className={styles.answerContainer} tabIndex={0}>

                <Stack.Item>
                    <Stack horizontal grow>
                        <Stack.Item grow>
                            <ReactMarkdown
                                linkTarget="_blank"
                                remarkPlugins={[remarkGfm, supersub]}
                                children={DOMPurify.sanitize(parsedAnswer.markdownFormatText, { ALLOWED_TAGS: XSSAllowTags })}
                                className={styles.answerText}
                            />
                        </Stack.Item>
                        <Stack.Item className={styles.answerHeader}>
                            {FEEDBACK_ENABLED && answer.message_id !== undefined && <Stack horizontal horizontalAlign="space-between">
                                <Text onClick={onFeedbackClicked} style={{ color: 'blue', cursor: 'pointer' }}>Give Feedback</Text>
                            </Stack>}
                        </Stack.Item>
                    </Stack>

                </Stack.Item>
                <Stack horizontal className={styles.answerFooter}>
                    {!!parsedAnswer.citations.length && (
                        <Stack.Item
                            onKeyDown={e => e.key === "Enter" || e.key === " " ? toggleIsRefAccordionOpen() : null}
                        >
                            <Stack style={{ width: "100%" }} >
                                <Stack horizontal horizontalAlign='start' verticalAlign='center'>
                                    <Text
                                        className={styles.accordionTitle}
                                        onClick={toggleIsRefAccordionOpen}
                                        aria-label="Open references"
                                        tabIndex={0}
                                        role="button"
                                    >
                                        <span>{parsedAnswer.citations.length > 1 ? parsedAnswer.citations.length + " references" : "1 reference"}</span>
                                    </Text>
                                    <FontIcon className={styles.accordionIcon}
                                        onClick={handleChevronClick} iconName={chevronIsExpanded ? 'ChevronDown' : 'ChevronRight'}
                                    />
                                </Stack>

                            </Stack>
                        </Stack.Item>
                    )}
                    <Stack.Item className={styles.answerDisclaimerContainer}>
                        <span className={styles.answerDisclaimer}>AI-generated content may be incorrect</span>
                    </Stack.Item>
                </Stack>
                {chevronIsExpanded &&
                    <div style={{ marginTop: 8, display: "flex", flexFlow: "wrap column", maxHeight: "150px", gap: "4px" }}>
                        {parsedAnswer.citations.map((citation, idx) => {
                            return (
                                <span
                                    title={createCitationFilepath(citation, ++idx)}
                                    tabIndex={0}
                                    role="link"
                                    key={idx}
                                    onClick={() => onCitationClicked(citation)}
                                    onKeyDown={e => e.key === "Enter" || e.key === " " ? onCitationClicked(citation) : null}
                                    className={styles.citationContainer}
                                    aria-label={createCitationFilepath(citation, idx)}
                                >
                                    <div className={styles.citation}>{idx}</div>
                                    {createCitationFilepath(citation, idx, true)}
                                </span>);
                        })}
                    </div>
                }
            </Stack>
            <Dialog
                onDismiss={() => {
                    resetFeedbackDialog();
                }}
                hidden={!isFeedbackDialogOpen}
                styles={{

                    main: [{
                        selectors: {
                            ['@media (min-width: 480px)']: {
                                maxWidth: '600px',
                                background: "#FFFFFF",
                                boxShadow: "0px 14px 28.8px rgba(0, 0, 0, 0.24), 0px 0px 8px rgba(0, 0, 0, 0.2)",
                                borderRadius: "8px",
                                maxHeight: '600px',
                                minHeight: '100px',
                            }
                        }
                    }]
                }}
                dialogContentProps={{
                    title: "Submit Feedback",
                    showCloseButton: true
                }}
            >
                <Stack tokens={{ childrenGap: 4 }}>
                    <div>Your feedback will improve this experience.</div>

                    <Rating
                        min={1}
                        max={5}
                        rating={rating}
                        onChange={handleRatingChange}
                    />

                    {rating !== undefined && rating <= 3 && (
                        !showReportInappropriateFeedback ? <UnhelpfulFeedbackContent /> : <ReportInappropriateFeedbackContent />)}

                    <div>Additional Comments:</div>

                    <textarea value={additionalComment} onChange={handleAdditionalCommentChange} rows={4} cols={50} placeholder="Enter your additional comments..." />

                    <div>By pressing submit, your feedback will be visible to the application owner.</div>

                    <DefaultButton disabled={rating === undefined} onClick={onSubmitFeedback}>Submit</DefaultButton>
                </Stack>

            </Dialog>
        </>
    );
};
