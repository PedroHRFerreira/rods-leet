import { ExternalLink } from "lucide-react";
import type { LearningResource } from "../lib/contracts";

export function LearningResourceList({
  heading,
  resources,
}: {
  heading: string;
  resources: LearningResource[];
}) {
  if (resources.length === 0) return null;

  return (
    <section className="learning-resource-group" aria-label={heading}>
      <h3>{heading}</h3>
      <div className="learning-resource-list">
        {resources.map((resource) => (
          <a
            className="learning-resource"
            href={resource.url}
            key={`${resource.category}:${resource.languageId ?? "concept"}:${resource.url}`}
            rel="noreferrer noopener"
            target="_blank"
          >
            <span>
              <strong>{resource.title}</strong>
              <small>{resource.description}</small>
            </span>
            <ExternalLink aria-hidden="true" size={16} />
          </a>
        ))}
      </div>
    </section>
  );
}
